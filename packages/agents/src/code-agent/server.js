import express from 'express';
import dotenv from 'dotenv';
import axios from 'axios';
import OpenAI from 'openai';
import AWS from 'aws-sdk';
import { BedrockClient, ListCustomModelsCommand } from "@aws-sdk/client-bedrock";
dotenv.config();

const app = express();
app.use(express.json());

const MODEL_PROVIDER = process.env.MODEL_PROVIDER || 'openai';

async function generateComponent(component, requirements) {
  const prompt = `Generate a ${component} component in React with TypeScript. The component should include ${requirements.join(', ')}.`;

  try {
    if (MODEL_PROVIDER === 'azure_openai') {
      const response = await axios.post(
        `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_DEFAULT_MODEL}/chat/completions?api-version=${process.env.AZURE_API_VERSION}`,
        { messages: [{ role: 'user', content: prompt }] },
        { headers: { 'api-key': process.env.AZURE_OPENAI_API_KEY } }
      );
      return response.data.choices[0].message.content;
    }

    if (MODEL_PROVIDER === 'openai') {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_4o_STRUCTURED_OUTPUT,
        messages: [{ role: 'user', content: prompt }],
      });
      return response.choices[0].message.content;
    }

    if (MODEL_PROVIDER === 'claude') {
      const response = await axios.post(
        process.env.AWS_API_ENDPOINT,
        { messages: [{ role: 'user', content: prompt }] },
        {
          headers: {
            'x-api-key': process.env.AWS_ACCESS_KEY_ID,
            'x-secret-key': process.env.AWS_SECRET_ACCESS_KEY,
          },
        }
      );
      return response.data.completions[0].message.content;
    }

    if (MODEL_PROVIDER === 'bedrock') {
      const bedrock = new AWS.BedrockRuntime({
        region: process.env.REGION_NAME,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      });

      const params = {
        modelId: 'claude-sonnet-3.5',
        contentType: 'application/json',
        input: JSON.stringify({
          prompt: prompt,
        }),
      };

      const response = await bedrock.invokeModel(params).promise();
      return JSON.parse(response.body).completions[0].message.content;
    }

    throw new Error('No valid model provider selected.');
  } catch (error) {
    console.error('Error generating component:', error);
    return 'Error generating component.';
  }
}

// API Route to Request Component Generation
app.post('/generate-component', async (req, res) => {
  const { component, requirements } = req.body;
  if (!component) return res.status(400).json({ error: 'Component name is required' });

  const generatedCode = await generateComponent(component, requirements);
  res.json({ message: 'Component generated successfully', code: generatedCode });
});

// API Route to List Available Models
app.get('/available-models', (req, res) => {
  res.json({
    activeModel: MODEL_PROVIDER,
    options: ['azure_openai', 'openai', 'claude', 'bedrock'],
  });
});

app.listen(5001, () => console.log(`Agent Coder API running on port 5001, using ${MODEL_PROVIDER}`));
