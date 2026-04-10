import {
  DeleteManyOptions,
  Pinecone,
  RecordMetadata,
  ScoredPineconeRecord,
} from "@pinecone-database/pinecone";

class PineconeClient {
  private static instance: PineconeClient;
  private client: Pinecone;
  private indexInstance: ReturnType<Pinecone["index"]> | null = null;

  private constructor() {
    this.client = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || "",
    });
  }

  static getInstance(): PineconeClient {
    if (!PineconeClient.instance) {
      PineconeClient.instance = new PineconeClient();
    }
    return PineconeClient.instance;
  }

  async index() {
    if (!this.indexInstance) {
      const indexModel = await this.client.describeIndex(
        process.env.PINECONE_INDEX_NAME || "rag-embeddings"
      );
      this.indexInstance = this.client.index({ host: indexModel.host });
    }
    return this.indexInstance;
  }

  async deleteMany(options: DeleteManyOptions) {
    await this.indexInstance?.deleteMany(options);
  }

  async query(vector: number[], topK: number, filter: any) {
    await this.indexInstance?.query({
      vector,
      topK,
      filter,
      includeMetadata: true,
    });
  }

  async queryByFilename(
    filename: string
  ): Promise<ScoredPineconeRecord<RecordMetadata>[]> {
    const dummyVector = new Array(1024).fill(0);
    dummyVector[0] = 0.0001;
    const queryResponse = await this.indexInstance?.query({
      topK: 1000,
      vector: dummyVector,
      includeMetadata: true,
      filter: { filename },
    });

    return queryResponse?.matches ?? [];
  }
}

export const getPinecone = () => PineconeClient.getInstance();

export const getPineconeIndex = () => getPinecone().index();
