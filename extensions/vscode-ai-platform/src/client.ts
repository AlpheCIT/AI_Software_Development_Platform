import axios, { AxiosInstance } from 'axios';

export class AIplatformClient {
  private http: AxiosInstance;

  constructor(serverUrl: string) {
    this.http = axios.create({
      baseURL: serverUrl,
      timeout: 60000,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async analyzeFile(filePath: string, content: string): Promise<any[]> {
    const response = await this.http.post('/api/v1/ai/analyze/security', {
      entityKey: filePath,
      coordinationType: 'debate',
      parameters: {
        sourceFiles: { [filePath]: content },
        enableVerification: true
      }
    });
    return response.data?.findings || [];
  }

  async analyzeWorkspace(workspacePath: string): Promise<any> {
    const response = await this.http.post('/api/v1/ai/analyze/comprehensive', {
      repositoryPath: workspacePath,
      coordinationType: 'debate',
      domains: ['SECURITY', 'PERFORMANCE', 'QUALITY', 'DEPENDENCY']
    });
    return response.data;
  }

  async getImpactAnalysis(filePath: string): Promise<any> {
    const response = await this.http.post('/api/v1/ai/analyze/impact', {
      filePath,
      maxDepth: 3
    });
    return response.data;
  }

  async getRemediation(findings: any[]): Promise<any[]> {
    const response = await this.http.post('/api/v1/ai/remediate', {
      verifiedFindings: findings
    });
    return response.data?.patches || [];
  }

  async generateDocumentation(filePath: string, content: string): Promise<any> {
    const response = await this.http.post('/api/v1/ai/generate/documentation', {
      parameters: {
        sourceFiles: { [filePath]: content }
      }
    });
    return response.data;
  }
}
