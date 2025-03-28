import { SageMakerRuntimeClient, InvokeEndpointCommand } from "@aws-sdk/client-sagemaker-runtime";
import { Pinecone } from '@pinecone-database/pinecone';
import type { NextApiRequest, NextApiResponse } from 'next'

// Initialize AWS SageMaker Runtime Client
const sagemakerRuntime = new SageMakerRuntimeClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
});

// Initialize Pinecone Client
const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY || "",
});
const index = pinecone.index(process.env.PINECONE_INDEX_NAME || "rag-embeddings");

// --- Embedding Function (using Sagemaker Embedding Endpoint) ---
async function embedDocs(docs) {
    const params = {
        EndpointName: process.env.SAGEMAKER_EMBEDDING_ENDPOINT_NAME || "minilm-embedding",
        ContentType: 'application/json',
        Body: JSON.stringify({ inputs: docs }),
    };

    try {
        const command = new InvokeEndpointCommand(params);
        const response = await sagemakerRuntime.send(command);
        const payload = new TextDecoder().decode(response.Body);
        const embeddings_raw = JSON.parse(payload);

        // Assuming the endpoint returns embeddings in a structure like [[...embeddings...]]
        // Adjust based on your actual endpoint response format
        const embeddings = embeddings_raw.vectors ? embeddings_raw.vectors : embeddings_raw; // Handling different possible output structures.  Inspect your endpoint output to make sure.

        if (!Array.isArray(embeddings) || embeddings.length === 0 || !Array.isArray(embeddings[0])) {
            console.error("Unexpected embedding format from SageMaker:", embeddings_raw);
            throw new Error("Unexpected embedding format from SageMaker.");
        }

        // If the endpoint already returns sentence embeddings, just use them directly
        return embeddings;


    } catch (error) {
        console.error("Error embedding documents:", error);
        throw error;
    }
}

// --- Construct Context Function ---
function constructContext(contexts, maxSectionLen = 5000) {
    let chosenSections: string[] = [];
    let chosenSectionsLen = 0;

    for (const text of contexts) {
        const trimmedText = text.trim();
        chosenSectionsLen += trimmedText.length + 2; // +2 for separator
        if (chosenSectionsLen > maxSectionLen) {
            break;
        }
        chosenSections.push(trimmedText);
    }
    const concatenatedDoc = chosenSections.join("\n");
    console.log(`Selected top ${chosenSections.length} document sections`); // Removed detailed log to reduce server logs
    return concatenatedDoc;
}

// --- Create Payload Function ---
function createPayload(question, contextStr) {
    const promptTemplate = `If the CONTEXT doesn't contain the answer, say "I think that" and provide your best guess. Be as concise and accurate as possible without repeating the question or context Answer the following short-answer QUESTION based on the CONTEXT given in LESS than 100 words.

    CONTEXT:
    {context}


    QUESTION:
    {question}

    ANSWER:
    `;

    const textInput = promptTemplate.replace("{context}", contextStr).replace("{question}", question);

    return {
        inputs: textInput,
        parameters: {
            max_new_tokens: 250,
            top_p: 0.99,
            temperature: 0.85,
            return_full_text: false,
        },
    };
}

// --- RAG Query Function ---
async function ragQuery(question): Promise<[string, any[]]> {
    try {
        const queryVecEmbeddings = await embedDocs([question]); // Embed the question
        if (!queryVecEmbeddings || !Array.isArray(queryVecEmbeddings) || queryVecEmbeddings.length === 0 || !Array.isArray(queryVecEmbeddings[0])) {
            throw new Error("Failed to get valid embeddings for the question.");
        }
        // console.log("Query Vec Length:", queryVecEmbeddings.length);
        const queryVec = queryVecEmbeddings[0][0]; // Take the first (and hopefully only) embedding
        if (!Array.isArray(queryVec)) { // Double check embedding structure
            throw new Error("Unexpected embedding structure.");
        }

        const queryResult = await index.query({
            vector: queryVec,
            topK: 10,
            includeMetadata: true,
        });

        const contexts = queryResult.matches
        const contextStr = constructContext(contexts.map(match => match.metadata?.text));
        const payload = createPayload(question, contextStr);

        const llamaParams = {
            EndpointName: process.env.SAGEMAKER_LLAMA_ENDPOINT_NAME, // e.g., 'llama-3-generator'
            ContentType: 'application/json',
            Body: JSON.stringify(payload),
            CustomAttributes: "accept_eula=true" // Very important for JumpStart models
        };

        const command = new InvokeEndpointCommand(llamaParams);
        const llamaResponse = await sagemakerRuntime.send(command);
        const llamaPayload = new TextDecoder().decode(llamaResponse.Body);
        const llamaOutput = JSON.parse(llamaPayload);

        // Cut off generated_text when the model starts repeating itself with ANSWER: or similar
        const llamaOutputText = llamaOutput.generated_text.split("ANSWER")[0].trim();

        return [llamaOutputText, contexts]; // Adjust based on your LLM endpoint output


    } catch (error) {
        console.error("Error in ragQuery:", error);
        throw error; // Re-throw to be caught by the API handler
    }
}

// --- API Endpoint Handler ---
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { question, history = [] } = req.body;

    if (!question) {
        return res.status(400).json({ message: 'Question is required' });
    }

    // Format the history and current question for the model
    // This is a simple example - you may need to adjust based on your model's requirements
    let formattedHistory = ''
    if (history.length > 0) {
        formattedHistory = history.map(msg =>
            `${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}`
        ).join('\n\n')

        formattedHistory += '\n\n'
    }
    const fullPrompt = `${formattedHistory}Human: ${question}`

    try {
        const response = await ragQuery(fullPrompt);
        const answer = response[0];
        const contexts = response[1];
        return res.status(200).json({ answer, contexts });
    } catch (error) {
        console.error("Error in RAG API:", error);
        return res.status(500).json({ message: 'Internal server error', error: error.message }); // Send generic error to client, avoid leaking server details
    }
}
