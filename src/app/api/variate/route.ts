import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";

// Type definitions
interface Persona {
  id: string;
  name: string;
  image: string;
  bio: string;
}

interface PersonaAnalysis {
  persona: Persona;
  analysis: string;
}

interface AdElement {
  text: string;
  type: string;
  whyItWorks: string;
  id: string;
}

interface ImageAnalysis {
  overallBlurb: string;
  elements: AdElement[];
}

interface AdVariation {
  id: string;
  type: string;
  before: string;
  after: string;
}

// Type guard for string
function isString(val: unknown): val is string {
  return typeof val === 'string';
}

async function analyzeAdImage(openai: OpenAI, base64Image: string): Promise<ImageAnalysis> {
    const AdElement = z.object({
        text: z.string(),
        type: z.string(), // e.g., "headline", "subheadline", "body", "CTA", "guarantee"
        whyItWorks: z.string(),
    });

    const AdAnalysis = z.object({
        overallBlurb: z.string(),
        elements: z.array(AdElement),
    });

    const imagePrompt = `You are an expert marketer. Analyze this advertisement image and return your answer as a JSON object with these keys:
        {
        "overallBlurb": "A concise summary of what makes this ad great overall.",
        "elements": [
            {
            "text": "The text from the ad element.",
            "type": "Type of copy (e.g., Headline, Subheadline, Body, CTA, Guarantee, etc.).",
            "whyItWorks": "A detailed explanation of what makes this element effective."
            }
            // ...repeat for each text element in the ad
        ]
        }
        Be extremely detailed in your analysis, especially in the 'whyItWorks' explanations.`;

    console.log("understanding image");
    const imageAnalysisResponse = await openai.responses.parse({
        model: "gpt-4.1-mini",
        input: [
            {
                role: "user",
                content: [
                    { type: "input_text", text: imagePrompt },
                    {
                        type: "input_image",
                        image_url: `data:image/jpeg;base64,${base64Image}`,
                        detail: "high"
                    },
                ],
            },
        ],
        text: {
            format: zodTextFormat(AdAnalysis, "adAnalysis"),
        },
    });
    console.log('imageAnalysisResponse', imageAnalysisResponse.output_text);
    // Assign unique IDs to each element
    const parsed = imageAnalysisResponse.output_parsed;
    if (!parsed) throw new Error('Image analysis parsing failed');
    const elementsWithId: AdElement[] = parsed.elements.map((el: { text: string; type: string; whyItWorks: string }, idx: number) => ({
        ...el,
        id: `element_${idx + 1}`
    }));
    return {
        overallBlurb: parsed.overallBlurb,
        elements: elementsWithId
    };
}

async function analyzePersona(openai: OpenAI, persona: Persona, productDescription: string): Promise<PersonaAnalysis> {
    const prompt = `Analyze how the following product resonates with this persona:
    
    Persona Name: ${persona.name}
    Persona Bio: ${persona.bio}
    Product Description: ${productDescription}

    1. Identify the 3 most compelling product benefits for this specific person

    2. Explain why these benefits would resonate with them

    3. Rank which product features would matter most to them

    4. Suggest messaging angles that would address their specific pain points

    5. Recommend the emotional triggers most likely to motivate a purchase

    Be specific and use the actual language patterns identified in each persona.`;
    // console.log('prompt', prompt);

    console.log('making persona call');
    const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
            {
                role: "user",
                content: prompt
            }
        ],
        temperature: 0.7,
        max_tokens: 500
    });

    return {
        persona,
        analysis: response.choices[0].message.content || ""
    };
}

async function generateAdVariations(
  openai: OpenAI,
  personaAnalysis: PersonaAnalysis,
  imageAnalysis: ImageAnalysis,
  productDescription: string
): Promise<AdVariation[]> {
    // For each original ad element, generate a new version tailored to the persona
    const results = await Promise.all(imageAnalysis.elements.map(async (element: AdElement) => {
        const prompt = `You are an expert marketer.
        - Rewrite this ad text to better resonate with the persona, keeping the type and intent, but improving it based on the persona's needs tailoring it towards the new product description.
        - Return only the improved text. 
        - You MUST keep the length of the text very similar to the original text.

        Here is the ad element from an original ad:
        Type: ${element.type}
        Text: "${element.text}"
        Why it works: ${element.whyItWorks}

        Product Description: ${productDescription}

        Persona Analysis:
        ${personaAnalysis.analysis}

`;

        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 200
        });

        let after = response.choices[0].message.content?.trim() || "";
        if ((after[0] === '"' && after[after.length - 1] === '"') || (after[0] === "'" && after[after.length - 1] === "'")) {
            after = after.slice(1, -1);
        }
        return {
            id: element.id,
            type: element.type,
            before: element.text,
            after
        };
    }));
    return results;
}
export const maxDuration = 120; // This function can run for a maximum of 5 seconds
export async function POST(request: Request) {
    try {
        // return NextResponse.json({
        //     success: true,
        //     message: 'Analysis and variations completed successfully',
        //     results: dummyData
        // });

        const body: {
            personas: Persona[];
            productDescription: string;
            selectedAd?: unknown;
            uploadedAdImage?: string | null;
            adImagePath?: string | null;
        } = await request.json();

        // Log the received data
        let adImageType = null;
        if (body.uploadedAdImage) {
            adImageType = 'uploadedAdImage (base64)';
        } else if (body.adImagePath) {
            adImageType = `adImagePath (${body.adImagePath})`;
        } else {
            adImageType = 'none';
        }
        console.log('Received data:', {
            personas: body.personas,
            productDescription: body.productDescription,
            selectedAd: body.selectedAd,
            adImageType
        });

        // Initialize OpenAI client
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        // Analyze the ad image if provided
        let imageAnalysis: ImageAnalysis | undefined;
        if (body.uploadedAdImage || body.adImagePath) {
            if (body.uploadedAdImage != null && isString(body.uploadedAdImage)) {
                const base64Image = body.uploadedAdImage;
                if (!base64Image) {
                    return NextResponse.json(
                        { success: false, message: 'Ad image could not be loaded' },
                        { status: 400 }
                    );
                }
                imageAnalysis = await analyzeAdImage(openai, base64Image);
            } else if (body.uploadedAdImage !== undefined && body.uploadedAdImage !== null) {
                return NextResponse.json(
                    { success: false, message: 'Uploaded ad image must be a base64 string.' },
                    { status: 400 }
                );
            } else if (body.adImagePath != null && isString(body.adImagePath)) {
                const base64Image = fs.readFileSync(`public${body.adImagePath}`, "base64");
                if (!base64Image) {
                    return NextResponse.json(
                        { success: false, message: 'Ad image could not be loaded' },
                        { status: 400 }
                    );
                }
                imageAnalysis = await analyzeAdImage(openai, base64Image);
            } else if (body.adImagePath !== undefined && body.adImagePath !== null) {
                return NextResponse.json(
                    { success: false, message: 'Ad image path must be a string.' },
                    { status: 400 }
                );
            } else {
                return NextResponse.json(
                    { success: false, message: 'No ad image provided' },
                    { status: 400 }
                );
            }
        }
        if (typeof imageAnalysis === 'undefined') {
            return NextResponse.json(
                { success: false, message: 'Ad image analysis is required to generate variations.' },
                { status: 400 }
            );
        }

        // Create an array of promises for parallel processing
        const personaAnalysisPromises = body.personas.map((persona: Persona) => 
            analyzePersona(openai, persona, body.productDescription)
        );

        // Wait for all analyses to complete
        const personaAnalyses = await Promise.all(personaAnalysisPromises);

        // Generate ad variations for each persona
        let results;
        if (imageAnalysis) {
            const adVariationsPromises = personaAnalyses.map(async (personaAnalysis) => {
                const variations = await generateAdVariations(openai, personaAnalysis, imageAnalysis, body.productDescription);
                return {
                    persona: personaAnalysis.persona,
                    analysis: personaAnalysis.analysis,
                    variations
                };
            });
            results = await Promise.all(adVariationsPromises);
        } else {
            return NextResponse.json(
                { success: false, message: 'Ad image analysis is required to generate variations.' },
                { status: 400 }
            );
        }

        // console.log('Results:', results);
        console.log('Results:', JSON.stringify(results, null, 2));

        return NextResponse.json({
            success: true,
            message: 'Analysis and variations completed successfully',
            adImageAnalysis: imageAnalysis,
            results
        });
    } catch (error) {
        console.error('Error processing request:', error);
        return NextResponse.json(
            { success: false, message: 'Error processing request' },
            { status: 500 }
        );
    }
} 

// Change let dummyData to const and comment it out since it's unused
// const dummyData = [
//   {
//     "persona": {
//       "id": "tech_persona_1",
//       "name": "Dev Dan - Full-Stack Developer",
//       "image": "/david.png",
//       "bio": "Dan is a 32-year-old full-stack developer working for a mid-sized tech startup in Austin, TX. He spends most of his day coding in React and Node.js, and loves exploring new technologies in his free time. He values tools that boost productivity and help him stay focused during deep work sessions."
//     },
//     "analysis": "1. The three most compelling product benefits for Dev Dan are the AI-powered auto-framing, the noise-canceling microphone, and the 4K resolution.\n\n2. The AI-powered auto-framing is beneficial for Dan as it eliminates the need to adjust the camera manually, allowing him to fully focus on his work. The noise-canceling microphone ensures that his communication with his team is clear and uninterrupted, aiding productivity. The 4K resolution provides high-quality visuals that can enhance the experience of remote collaboration and presentations.\n\n3. In order of importance, the product features that would matter most to Dan are the noise-canceling microphone, the AI-powered auto-framing, and the 4K resolution. Clear communication is critical for Dan as a developer, and so the noise-canceling microphone would be highly valuable. The AI-powered auto-framing and 4K resolution would also be important but to a lesser degree.\n\n4. Messaging angles that would address Dan's specific pain points could include focusing on how the webcam can enhance productivity and reduce distractions. For example, \"Stay focused and productive with our AI-powered auto-framing feature – no need to manually adjust your camera during meetings.\" Or \"Ensure clear communication with your team with our noise-canceling microphone – no more interruptive background noises.\"\n\n5. The emotional triggers most likely to motivate a purchase for Dan would be the sense of efficiency and productivity that the product offers. Messaging that emphasizes these aspects, such as \"Maximize your productivity with our professional-grade 4K webcam\" or \"Effortlessly collaborate with your team with clear visuals and sound\", would likely resonate with him.",
//     "variations": {
//       "headlines": [
//         "Unleash Productivity with AI-Powered Webcam",
//         "Experience Clear Communication Like Never Before",
//         "Maximize Your Efficiency with Our 4K Webcam"
//       ],
//       "subheadlines": [
//         "Say goodbye to manual adjustments with AI auto-framing",
//         "Eliminate background noise for uninterrupted communication",
//         "Enhance remote collaboration with high-quality visuals"
//       ],
//       "bodyCopies": [
//         "Our AI-powered auto-framing feature lets you focus on what truly matters - your work. No more interruptions for manual adjustments during your meetings.",
//         "Our noise-canceling microphone ensures clear and efficient communication with your team, cutting out all the background noise that interrupts your productivity.",
//         "Experience the true essence of remote collaboration with our 4K webcam that provides crystal clear visuals for your presentations and meetings."
//       ],
//       "guarantees": [
//         "Guaranteed to enhance your productivity with our AI-powered auto-framing feature",
//         "Promise clear, undisturbed communication with our noise-canceling microphone",
//         "Assured high-quality visuals with our 4K resolution feature"
//       ],
//       "ctas": [
//         "Buy now to experience effortless productivity",
//         "Order now to enjoy clear, uninterrupted communication",
//         "Purchase today for high-quality visuals"
//       ]
//     }
//   },
//   {
//     "persona": {
//       "id": "tech_persona_2",
//       "name": "Product Paula - UX/UI Designer",
//       "image": "/paula.png",
//       "bio": "Paula is a 28-year-old UX/UI designer living in San Francisco. She works remotely for a SaaS company and specializes in creating intuitive user experiences. Paula is always on the lookout for design inspiration and tools that help her communicate ideas effectively with engineering teams."
//     },
//     "analysis": "1. The three most compelling product benefits for Product Paula - UX/UI Designer would be: \n   - AI-powered auto-framing: This feature ensures that she is always in focus, creating a professional impression during remote meetings.\n   - Noise-canceling microphone: This feature ensures that all her communication is clear and without any distracting background noise.\n   - Professional-grade 4K webcam: This high-resolution feature can help her deliver high-quality visuals, crucial for demonstrating her designs and ideas effectively.\n\n2. These benefits would resonate with Paula as they directly address her professional needs. As a UX/UI designer, Paula needs to communicate her ideas effectively and professionally. The AI-powered auto-framing and noise-canceling microphone allow her to convey her ideas clearly, without any distractions. The 4K webcam ensures that her designs are displayed in high-quality, which is critical for a designer.\n\n3. The product features that would matter most to Paula, in order of importance are:\n   - Professional-grade 4K webcam: This is the most crucial feature for Paula as it determines the quality of her visual presentations, which is critical in her field.\n   - AI-powered auto-framing: This feature is second in importance as it ensures she is always the focal point during her presentations.\n   - Noise-canceling microphone: Although also important, this ranks third as it aids in clear communication, but doesn't directly impact her design presentations.\n\n4. Messaging angles could include:\n   - \"Unleash your design potential with crystal-clear 4K presentations\"\n   - \"Stay in focus, always, with our AI-powered auto-framing\"\n   - \"Say goodbye to distracting background noise during important meetings\"\n\n5. Emotional triggers likely to motivate a purchase:\n   - A desire for professional credibility: The high-tech features of the webcam can help her project a professional image.\n   - A need for effective communication: The noise-canceling microphone and auto-framing can greatly enhance her communication with her team.\n   - A sense of pride in her work: The 4K webcam ensures her designs are presented in the best possible quality.",
//     "variations": {
//       "headlines": [
//         "Unleash Your Design Power",
//         "Always in Focus, Always Clear",
//         "Crystal-Clear 4K For Your Designs"
//       ],
//       "subheadlines": [
//         "AI-powered framing for professional meetings",
//         "Noise-canceling microphone for clear communication",
//         "Professional-grade 4K webcam for high-quality visuals"
//       ],
//       "bodyCopies": [
//         "Enhance your presentations with our professional-grade 4K webcam, backed by AI-powered auto-framing. Enjoy clear, distraction-free communication with our noise-canceling microphone.",
//         "Our webcam offers high-quality 4K visuals, perfect for showcasing your designs. Stay the center of attention with AI-powered auto-framing and enjoy clear conversations with our noise-canceling microphone.",
//         "Present your designs in stunning clarity with our 4K webcam. Our AI-powered auto-framing ensures you're always the focal point, while the noise-canceling microphone eliminates any distracting background noise."
//       ],
//       "guarantees": [
//         "Awarded for superior performance and quality",
//         "Trusted by professionals worldwide",
//         "Designed for perfection and backed by our satisfaction guarantee"
//       ],
//       "ctas": [
//         "Upgrade your meetings today",
//         "Experience the difference now",
//         "Unleash your design potential today"
//       ]
//     }
//   },
//   {
//     "persona": {
//       "id": "tech_persona_3",
//       "name": "Tech Tom - Startup Founder",
//       "image": "/tom.png",
//       "bio": "Tom is a 41-year-old entrepreneur who recently founded his third tech startup in New York City. With a background in machine learning, he now focuses on business strategy and fundraising. Tom needs tools that help him make data-driven decisions and stay connected with his distributed team."
//     },
//     "analysis": "1. The three most compelling product benefits for Tech Tom are: \n\n   - AI-powered auto-framing: This feature ensures that he is always in focus during calls with his distributed team, investors, or potential partners, enhancing his professional image.\n    \n   - Noise-canceling microphone: This allows him to communicate clearly, without any background noise distractions, ensuring that his messages are always clear and understood.\n    \n   - Professional-grade 4K webcam: This provides high-quality video, making his virtual interactions feel more in-person and improving the quality of his team's collaboration.\n\n2. These benefits would resonate with Tech Tom because as a startup founder, clear communication and a professional image are key to his success. The AI-powered auto-framing and noise-canceling microphone enable him to conduct high-quality meetings, which is crucial for his business strategy and fundraising efforts. Additionally, the 4K webcam can help him create a sense of closeness and connection with his distributed team, which can boost morale and productivity.\n\n3. The product features that would matter most to Tech Tom, ranked from most to least important, are: \n\n   - Noise-canceling microphone: This is crucial for clear communication in his day-to-day discussions with his team and external stakeholders.\n    \n   - AI-powered auto-framing: This feature enhances his professional image during virtual meetings.\n    \n   - Professional-grade 4K webcam: While this feature enhances the quality of his virtual interactions, it is not as critical as the first two because lower video quality can be tolerated if the audio communication is clear.\n\n4. Messaging angles that would address Tech Tom's specific pain points could include: \n\n   - \"Never miss an important detail during your meetings with our AI-powered auto-framing and noise-canceling microphone.\"\n    \n   - \"Achieve in-person meeting quality from anywhere with our professional-grade 4K webcam.\"\n    \n   - \"Stay connected with your remote team and present your best self to potential investors with clear, high-quality video and audio.\"\n\n5. The emotional triggers most likely to motivate a purchase for Tech Tom would be: \n\n   - Reassurance: Stressing the reliability and consistency of the webcam can reassure him that his communications will always be clear and professional.\n    \n   - Success: Highlighting how this product can aid in his business strategy and fundraising efforts can tap into his desire for success.\n    \n   - Control: Emphasizing the precision and control offered by the product's features can appeal to his need for control",
//     "variations": {
//       "headlines": [
//         "Boost Your Virtual Presence Now",
//         "Superior Tech for Exceptional Communication",
//         "Unleash Power of AI in Your Meetings"
//       ],
//       "subheadlines": [
//         "Experience Clear, Professional-Grade Communication",
//         "No More Background Noise or Blur",
//         "AI-Powered Auto-Framing for Perfect Focus"
//       ],
//       "bodyCopies": [
//         "Discover the next generation of virtual communication with our AI-powered webcam. Enjoy crystal-clear audio and exceptional video quality, ensuring you always make the right impression.",
//         "Don't let technical issues hinder your business. With our noise-canceling microphone and 4K webcam, you'll never miss a detail. Perfect for entrepreneurs, startup founders, and remote teams.",
//         "Enhance your professional image with our cutting-edge technology. Our AI-powered auto-framing keeps you in focus, while our noise-canceling microphone ensures your message is always heard loud and clear."
//       ],
//       "guarantees": [
//         "Trust in our technology. We guarantee clear audio and high-quality video for all your virtual interactions.",
//         "We guarantee you'll experience a noticeable improvement in your virtual meetings or your money back.",
//         "Experience the future of communication risk-free with our 30-day money-back guarantee."
//       ],
//       "ctas": [
//         "Join the Future of Communication Now",
//         "Improve Your Virtual Meetings Today",
//         "Experience Clearer Communication Now"
//       ]
//     }
//   }
// ]