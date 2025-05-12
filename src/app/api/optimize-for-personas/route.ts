import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { toFile } from 'openai';

export async function POST(request) {
  try {
    const { originalImage, prompt, personas, quality = 'medium' } = await request.json();
    
    if (!originalImage || !prompt || !personas || !Array.isArray(personas)) {
      return NextResponse.json(
        { error: 'Original image, prompt, and personas array are required' },
        { status: 400 }
      );
    }

    // Initialize the OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Convert base64 to a File object for the edit API
    const baseImageData = originalImage.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(baseImageData, 'base64');
    const imageFile = await toFile(imageBuffer, 'image.png', { type: 'image/png' });

    // Generate variations for each persona (limited to 3)
    const variations = [];
    
    // Only process the first 3 personas to limit API calls
    const limitedPersonas = personas.slice(0, 3);
    
    // Track cost for persona optimizations
    let optimizationCost = 0;
    const COST_PER_IMAGE_EDIT = 0.040; // $0.040 per 1024x1024 image edit
    
    for (const persona of limitedPersonas) {
      // Create a persona-specific prompt
      console.log(persona)
      const personaPrompt = `Optimize this image for ${persona.name} audience persona. 
        Keep the general concept but adjust colors, style, and presentation to appeal specifically to this persona.
        Original prompt: ${prompt}
        Persona bio: ${persona.bio}`;
      
      try {
        // Use OpenAI to generate a persona-specific variation
        const editResult = await openai.images.edit({
          model: "gpt-image-1",
          image: imageFile,
          prompt: personaPrompt,
          n: 1,
          size: "1024x1024",
          quality: quality,
        });
        
        const imageData = editResult.data[0].b64_json;
        
        // Add cost for this image edit
        optimizationCost += COST_PER_IMAGE_EDIT;
        
        variations.push({
          personaId: persona.id,
          personaName: persona.name,
          image: `data:image/png;base64,${imageData}`
        });
        
        console.log(`Generated variation for persona: ${persona.name}`);
      } catch (error) {
        console.error(`Error generating variation for persona ${persona.name}:`, error);
        // Instead of failing the whole request, add an error message
        variations.push({
          personaId: persona.id,
          personaName: persona.name,
          image: originalImage, // Use original as fallback
          error: error.message || 'Failed to generate persona variation'
        });
      }
    }

    return NextResponse.json({ 
      variations,
      optimizationCost: optimizationCost.toFixed(4)
    });
    
  } catch (error) {
    console.error('Persona optimization error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to optimize images for personas' },
      { status: 500 }
    );
  }
}