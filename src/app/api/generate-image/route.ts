import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { toFile } from 'openai';
import { 
  INITIAL_IMAGE_PROMPT, 
  IMAGE_EVALUATION_PROMPT, 
  IMAGE_IMPROVEMENT_PROMPT 
} from './prompts';

export async function POST(request) {
  const { prompt } = await request.json();
  
  if (!prompt) {
    return NextResponse.json(
      { error: 'Prompt is required' },
      { status: 400 }
    );
  }

  const finalPrompt = `${INITIAL_IMAGE_PROMPT} ${prompt}`;

  // Set up streaming response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Initialize cost tracking
        let totalCost = 0;
        
        // Initialize the OpenAI client
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });

        // Send initial status update
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'status',
          message: 'Generating initial image...'
        })}\n\n`));
        console.log('prompt', prompt)
        // Generate the initial image
        let result = await openai.images.generate({
          model: "gpt-image-1",
          prompt: finalPrompt,
          n: 1,
          size: "1024x1024",
          quality: "low",
        });
        
        // Calculate cost for image generation (1024x1024)
        totalCost += 0.040; // $0.040 per 1024x1024 image
        
        let imageData = result.data[0].b64_json;
        const usageData = result.usage
        console.log('initial usage data', usageData)
        
        // Send the initial image to the frontend
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'image',
          step: 0,
          imageData: `data:image/png;base64,${imageData}`,
          message: 'Initial image generated. Evaluating quality...'
        })}\n\n`));
        
        let isApproved = false;
        let attempts = 0;
        const MAX_ATTEMPTS = 4;
        
        // Iterative improvement process
        while (!isApproved && attempts < MAX_ATTEMPTS) {
          attempts++;
          
          // Evaluate the image using OpenAI's vision capabilities
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'status',
            message: `Evaluating image quality (attempt ${attempts})...`
          })}\n\n`));
          const evaluation = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "user",
                content: [
                  { 
                    type: "text", 
                    text: IMAGE_EVALUATION_PROMPT
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:image/png;base64,${imageData}`
                    }
                  }
                ]
              }
            ],
            max_tokens: 300
          });
          
          const evaluationText = evaluation.choices[0].message.content;
          const usageData = evaluation.usage
          console.log('usage data for evaluation', usageData)
          
          // Calculate cost for GPT-4o evaluation
          if (usageData) {
            const promptCost = (usageData.prompt_tokens / 1000) * 0.005;
            const completionCost = (usageData.completion_tokens / 1000) * 0.015;
            totalCost += promptCost + completionCost;
          }
          
          // Send evaluation result to frontend
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'evaluation',
            step: attempts,
            feedback: evaluationText
          })}\n\n`));
          
          // Check if the image is approved
          if (evaluationText.includes("APPROVED")) {
            isApproved = true;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'complete',
              finalImage: `data:image/png;base64,${imageData}`,
              isApproved: true,
              message: 'Image approved! Process complete.',
              totalCost: totalCost.toFixed(4)
            })}\n\n`));
            break;
          }
          
          // If not approved and we haven't reached max attempts, try to improve the image
          if (attempts < MAX_ATTEMPTS) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'status',
              message: `Improving image based on feedback (attempt ${attempts})...`
            })}\n\n`));
            
            // Create an improved prompt based on the evaluation
            const improvedPrompt = IMAGE_IMPROVEMENT_PROMPT
              .replace('{originalPrompt}', prompt)
              .replace('{evaluationFeedback}', evaluationText);
            
            // Convert base64 to a File object for the edit API
            const imageBuffer = Buffer.from(imageData, 'base64');
            const imageFile = await toFile(imageBuffer, 'image.png', { type: 'image/png' });
            
            // Properly call the edit API with the image
            const editResult = await openai.images.edit({
              model: "gpt-image-1",
              image: imageFile,
              prompt: improvedPrompt,
              n: 1,
              size: "1024x1024",
              quality: "medium",
            });
            
            // Calculate cost for image edit (1024x1024)
            totalCost += 0.040; // $0.040 per 1024x1024 image edit
            
            imageData = editResult.data[0].b64_json;
            
            // Send the improved image to the frontend
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'image',
              step: attempts,
              imageData: `data:image/png;base64,${imageData}`,
              message: `Image improved (attempt ${attempts}). Re-evaluating...`
            })}\n\n`));
          }
        }
        
        // If we've reached max attempts but the image is not approved
        if (!isApproved) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'complete',
            finalImage: `data:image/png;base64,${imageData}`,
            isApproved: false,
            message: `Reached maximum attempts. Using best generated image.`,
            totalCost: totalCost.toFixed(4)
          })}\n\n`));
        } else {
          // Update the approved message to include cost
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'complete',
            finalImage: `data:image/png;base64,${imageData}`,
            isApproved: true,
            message: 'Image approved! Process complete.',
            totalCost: totalCost.toFixed(4)
          })}\n\n`));
        }
        
        // Close the stream
        controller.close();
      } catch (error) {
        console.error('Image generation error:', error);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'error',
          error: error.message || 'Failed to generate image'
        })}\n\n`));
        controller.close();
      }
    }
  });

  // Return a streaming response
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}