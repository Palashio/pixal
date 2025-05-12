// Prompts used for image generation and evaluation

// Base prompt template for initial image generation
export const INITIAL_IMAGE_PROMPT = 
  "generate an image of this description. make sure that the text on the image is clear, " +
  "and that you follow the prompt exactly. you are generating this image for a tech product visualization.";

// Evaluation prompt for GPT-4o to assess image quality
export const IMAGE_EVALUATION_PROMPT = 
  "Evaluate this image for quality issues such as blurry text, distortions, or other problems. " +
  "Be extremely critical. You should also evaluate it if it's appealing as a tech product visualization. " +
  "Make sure all of the text is able to be seen and in frame. If the image looks good and has no major issues, " +
  "say 'APPROVED'. If the image needs to be fixed, be very specific about what needs to be fixed. " +
  "If the image needs to be fixed don't include the word APPROVED in your response. " +
  "Talk about what needs to be fixed, where, and how. Output the suggested text without any ** characters.";

// Template for improving the image based on evaluation feedback
export const IMAGE_IMPROVEMENT_PROMPT = 
  "{originalPrompt}. Improvements needed: {evaluationFeedback}. " +
  "Keep everything in the image the same except for what is specified to be changed."; 