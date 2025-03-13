import { SageMakerRuntimeClient, InvokeEndpointCommand } from "@aws-sdk/client-sagemaker-runtime";
import { Pinecone } from '@pinecone-database/pinecone';

// Initialize AWS SageMaker Runtime Client
const sagemakerRuntime = new SageMakerRuntimeClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        // sessionToken: process.env.AWS_SESSION_TOKEN,
    },
});

// Initialize Pinecone Client
const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
});
const index = pinecone.index(process.env.PINECONE_INDEX_NAME);

// --- Embedding Function (using Sagemaker Embedding Endpoint) ---
async function embedDocs(docs) {
    const params = {
        EndpointName: process.env.SAGEMAKER_EMBEDDING_ENDPOINT_NAME, // e.g., 'minilm-embedding'
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


// --- Split Text Function (Simplified - adjust as needed) ---
function splitText(text, maxLength = 500) {
    // Basic split by spaces, may need more sophisticated logic
    const words = text.split(' ');
    const chunks = [];
    let currentChunk = '';
    for (const word of words) {
        if (currentChunk.length + word.length + 1 > maxLength && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            currentChunk = '';
        }
        currentChunk += (currentChunk ? ' ' : '') + word;
    }
    if (currentChunk) {
        chunks.push(currentChunk.trim());
    }
    return chunks;
}

// --- Construct Context Function ---
function constructContext(contexts, maxSectionLen = 5000) {
    let chosenSections = [];
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
    const promptTemplate = `Answer the following QUESTION based on the CONTEXT given in LESS than 100 words. If the CONTEXT doesn't contain the answer truthfully say "I don't know, but I think" and provide your best guess.
git
    CONTEXT:
    {context}


    QUESTION:
    {question}
    `;

    const textInput = promptTemplate.replace("{context}", contextStr).replace("{question}", question);

    return {
        inputs: textInput,
        parameters: {
            max_new_tokens: 300,
            top_p: 0.9,
            temperature: 0.9,
            return_full_text: false,
        },
    };
}


// --- RAG Query Function ---
async function ragQuery(question) {
    try {
        const queryVecEmbeddings = await embedDocs([question]); // Embed the question
        if (!queryVecEmbeddings || !Array.isArray(queryVecEmbeddings) || queryVecEmbeddings.length === 0 || !Array.isArray(queryVecEmbeddings[0])) {
            throw new Error("Failed to get valid embeddings for the question.");
        }
        console.log("Query Vec Length:", queryVecEmbeddings.length);
        const queryVec = queryVecEmbeddings[0][0]; // Take the first (and hopefully only) embedding
        if (!Array.isArray(queryVec)) { // Double check embedding structure
            throw new Error("Unexpected embedding structure.");
        }

        const queryResult = await index.query({
            vector: queryVec,
            topK: 15,
            includeMetadata: true,
        });

        const contexts = queryResult.matches.map(match => match.metadata.text);
        const contextStr = constructContext(contexts);
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

        return llamaOutput.generated_text; // Adjust based on your LLM endpoint output


    } catch (error) {
        console.error("Error in ragQuery:", error);
        throw error; // Re-throw to be caught by the API handler
    }
}


// --- API Endpoint Handler ---
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { question } = req.body;

    if (!question) {
        return res.status(400).json({ message: 'Question is required' });
    }

    try {
        const answer = await ragQuery(question);
        return res.status(200).json({ answer });
    } catch (error) {
        console.error("API Error:", error); // Log detailed error on server side
        return res.status(500).json({ message: 'Error processing your request', error: error.message }); // Send generic error to client, avoid leaking server details
    }
}
