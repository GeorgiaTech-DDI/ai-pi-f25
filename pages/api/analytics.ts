import { Pinecone } from "@pinecone-database/pinecone";
import type { NextApiRequest, NextApiResponse } from "next";

// Initialize Pinecone Client
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || "",
});
const index = pinecone.index(process.env.PINECONE_INDEX_NAME || "rag-embeddings");

interface QueryLog {
  timestamp: string;
  question: string;
  bestScore: number;
  totalMatches: number;
  relevantMatches: number;
  matchesAbove06: number;
  matchesAbove05: number;
  matchesAbove04: number;
  topDocuments: { filename: string; score: number }[];
  decision: 'USE_RAG' | 'USE_GENERAL';
  confidenceLevel: 'high' | 'medium' | 'low';
}

interface DocumentationGap {
  question: string;
  frequency: number;
  bestScore: number;
  topDocument: string;
  lastAsked: string;
}

interface DocumentPerformance {
  filename: string;
  queryCount: number;
  averageScore: number;
  highScoreCount: number;
  status: 'excellent' | 'good' | 'needs_improvement';
}

interface AnalyticsResponse {
  summary: {
    totalQueries: number;
    ragSuccessCount: number;
    generalFallbackCount: number;
    ragSuccessRate: number;
    avgBestScore: number;
  };
  documentationGaps: DocumentationGap[];
  documentPerformance: DocumentPerformance[];
  recentLogs: QueryLog[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  // Simple authentication check (same as files API)
  const userEmail = req.headers['x-user-email'] as string;
  const userName = req.headers['x-user-name'] as string;

  if (!userEmail || !userName) {
    console.log('❌ Analytics request missing auth headers');
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!userEmail.endsWith('@gatech.edu')) {
    console.log(`❌ Unauthorized analytics access attempt by: ${userEmail}`);
    return res.status(403).json({ error: 'Access denied. Only @gatech.edu users can access analytics.' });
  }

  console.log(`📊 Analytics request from: ${userEmail}`);

  try {
    // Create dummy query vector with at least one non-zero value (Pinecone requirement)
    const dummyVector = new Array(1024).fill(0);
    dummyVector[0] = 0.0001; // Small non-zero value to satisfy Pinecone

    // Query Pinecone for all query logs
    const queryResult = await index.query({
      vector: dummyVector,
      topK: 10000, // Get a large number of logs
      includeMetadata: true,
      filter: {
        type: "query_log"
      }
    });

    console.log(`📊 Retrieved ${queryResult.matches.length} query logs from Pinecone`);

    // Parse logs from metadata
    const logs: QueryLog[] = queryResult.matches
      .map(match => {
        if (match.metadata && match.metadata.type === 'query_log') {
          // Deserialize topDocuments from JSON string
          let topDocuments: { filename: string; score: number }[] = [];
          try {
            const topDocsString = match.metadata.topDocuments as string;
            if (topDocsString && typeof topDocsString === 'string') {
              topDocuments = JSON.parse(topDocsString);
            }
          } catch (parseError) {
            console.warn('Failed to parse topDocuments:', parseError);
            topDocuments = [];
          }

          return {
            timestamp: match.metadata.timestamp as string,
            question: match.metadata.question as string,
            bestScore: match.metadata.bestScore as number,
            totalMatches: match.metadata.totalMatches as number,
            relevantMatches: match.metadata.relevantMatches as number,
            matchesAbove06: match.metadata.matchesAbove06 as number,
            matchesAbove05: match.metadata.matchesAbove05 as number,
            matchesAbove04: match.metadata.matchesAbove04 as number,
            topDocuments: topDocuments,
            decision: match.metadata.decision as 'USE_RAG' | 'USE_GENERAL',
            confidenceLevel: match.metadata.confidenceLevel as 'high' | 'medium' | 'low'
          };
        }
        return null;
      })
      .filter((log): log is QueryLog => log !== null)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Calculate summary statistics
    const totalQueries = logs.length;
    const ragSuccessCount = logs.filter(log => log.decision === 'USE_RAG').length;
    const generalFallbackCount = logs.filter(log => log.decision === 'USE_GENERAL').length;
    const ragSuccessRate = totalQueries > 0 ? (ragSuccessCount / totalQueries) * 100 : 0;
    const avgBestScore = totalQueries > 0 
      ? logs.reduce((sum, log) => sum + log.bestScore, 0) / totalQueries 
      : 0;

    // Identify documentation gaps (queries that failed to find good docs)
    const failedQueries = logs.filter(log => log.decision === 'USE_GENERAL');
    const questionFrequency = new Map<string, { count: number, bestScore: number, topDoc: string, lastAsked: string }>();

    failedQueries.forEach(log => {
      const normalized = log.question.toLowerCase().trim();
      const existing = questionFrequency.get(normalized);
      if (existing) {
        existing.count++;
        existing.lastAsked = log.timestamp;
      } else {
        questionFrequency.set(normalized, {
          count: 1,
          bestScore: log.bestScore,
          topDoc: log.topDocuments?.[0]?.filename || 'none',
          lastAsked: log.timestamp
        });
      }
    });

    const documentationGaps: DocumentationGap[] = Array.from(questionFrequency.entries())
      .map(([question, data]) => ({
        question,
        frequency: data.count,
        bestScore: data.bestScore,
        topDocument: data.topDoc,
        lastAsked: data.lastAsked
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10); // Top 10 gaps

    // Calculate document performance
    const documentStats = new Map<string, { scores: number[], count: number }>();

    logs.forEach(log => {
      log.topDocuments?.forEach(doc => {
        if (doc.filename && doc.filename !== 'none') {
          const existing = documentStats.get(doc.filename);
          if (existing) {
            existing.scores.push(doc.score);
            existing.count++;
          } else {
            documentStats.set(doc.filename, {
              scores: [doc.score],
              count: 1
            });
          }
        }
      });
    });

    const documentPerformance: DocumentPerformance[] = Array.from(documentStats.entries())
      .map(([filename, data]) => {
        const avgScore = data.scores.reduce((sum, s) => sum + s, 0) / data.scores.length;
        const highScoreCount = data.scores.filter(s => s >= 0.7).length;
        const status: 'excellent' | 'good' | 'needs_improvement' = avgScore >= 0.7 ? 'excellent' : avgScore >= 0.5 ? 'good' : 'needs_improvement';
        
        return {
          filename,
          queryCount: data.count,
          averageScore: avgScore,
          highScoreCount,
          status
        };
      })
      .sort((a, b) => b.queryCount - a.queryCount)
      .slice(0, 15); // Top 15 documents

    // Recent logs (last 20)
    const recentLogs = logs.slice(0, 20);

    const analytics: AnalyticsResponse = {
      summary: {
        totalQueries,
        ragSuccessCount,
        generalFallbackCount,
        ragSuccessRate,
        avgBestScore
      },
      documentationGaps,
      documentPerformance,
      recentLogs
    };

    console.log(`✅ Analytics generated: ${totalQueries} queries analyzed`);
    return res.status(200).json(analytics);

  } catch (error) {
    console.error('❌ Error generating analytics:', error);
    return res.status(500).json({ 
      error: 'Failed to generate analytics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

