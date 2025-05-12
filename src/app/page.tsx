'use client';

import { useState, useEffect, useRef } from 'react';

// Add global animation styles
const globalStyles = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  .animate-fadeIn {
    animation: fadeIn 0.5s ease-out forwards;
    opacity: 0;
  }
  
  @keyframes glow {
    0% { box-shadow: 0 0 5px rgba(147, 51, 234, 0.2); }
    50% { box-shadow: 0 0 15px rgba(147, 51, 234, 0.4); }
    100% { box-shadow: 0 0 5px rgba(147, 51, 234, 0.2); }
  }
  
  .variations-glow {
    animation: glow 2s ease-in-out infinite;
  }
`;

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [totalCost, setTotalCost] = useState<string>('0');
  const [techPersonas, setTechPersonas] = useState<Array<{id: string, name: string, image: string, bio: string}>>([]);
  const [generationLog, setGenerationLog] = useState<Array<{
    type: 'status' | 'image' | 'evaluation' | 'result' | 'error' | 'personaVariations';
    message?: string;
    image?: string;
    personaVariations?: Array<{
      personaId: string;
      personaName: string;
      image: string;
    }>;
    step?: number;
    timestamp: number;
  }>>([]);
  // Add state for editing personas
  const [editingPersona, setEditingPersona] = useState<{id: string, name: string, image: string, bio: string} | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Reference for auto-scrolling
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when log updates
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [generationLog]);

  // Fetch tech personas on component mount
  useEffect(() => {
    // Define tech persona info
    const personas = [
      { 
        id: 'tech_persona_1', 
        name: 'Dev Dan - Full-Stack Developer', 
        image: '/david.png', 
        bio: 'Dan is a 32-year-old full-stack developer working for a mid-sized tech startup in Austin, TX. He spends most of his day coding in React and Node.js, and loves exploring new technologies in his free time. He values tools that boost productivity and help him stay focused during deep work sessions.' 
      },
      { 
        id: 'tech_persona_2', 
        name: 'Product Paula - UX/UI Designer', 
        image: '/paula.png', 
        bio: 'Paula is a 28-year-old UX/UI designer living in San Francisco. She works remotely for a SaaS company and specializes in creating intuitive user experiences. Paula is always on the lookout for design inspiration and tools that help her communicate ideas effectively with engineering teams.' 
      },
      { 
        id: 'tech_persona_3', 
        name: 'Tech Tom - Startup Founder', 
        image: '/tom.png', 
        bio: 'Tom is a 41-year-old entrepreneur who recently founded his third tech startup in New York City. With a background in machine learning, he now focuses on business strategy and fundraising. Tom needs tools that help him make data-driven decisions and stay connected with his distributed team.' 
      },
    ];
    
    setTechPersonas(personas);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchQuery.trim() || isLoading) return;
    
    // Clear previous responses
    setGenerationLog([]);
    setIsLoading(true);
    setTotalCost('0');
    
    // Check if user is asking to create an image
    if (searchQuery != '') {
      try {
        // Add initial status to log
        setGenerationLog(prev => [...prev, {
          type: 'status',
          message: 'Starting image generation process...',
          timestamp: Date.now()
        }]);
        
        // Extract the description from the prompt
        const promptText = searchQuery.toLowerCase().replace('create an image', '').trim();
        const imageDescription = promptText || 'a beautiful landscape';
        
        // Create a proper EventSource for POST request
        const response = await fetch('/api/generate-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt: imageDescription }),
        });
        
        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }
        
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Stream not available');
        }
        
        // Read the stream
        const decoder = new TextDecoder();
        let buffer = '';
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          // Decode and append to buffer
          buffer += decoder.decode(value, { stream: true });
          
          // Process complete events from buffer
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || ''; // Keep the last incomplete chunk in the buffer
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));
                
                switch (data.type) {
                  case 'status':
                    setGenerationLog(prev => [...prev, {
                      type: 'status',
                      message: data.message,
                      timestamp: Date.now()
                    }]);
                    break;
                    
                  case 'image':
                    setGenerationLog(prev => [...prev, {
                      type: 'image',
                      message: data.message,
                      image: data.imageData,
                      step: data.step,
                      timestamp: Date.now()
                    }]);
                    break;
                    
                  case 'evaluation':
                    setGenerationLog(prev => [...prev, {
                      type: 'evaluation',
                      message: data.feedback,
                      step: data.step,
                      timestamp: Date.now()
                    }]);
                    break;
                    
                  case 'complete':
                    setGenerationLog(prev => [...prev, {
                      type: 'result',
                      message: data.isApproved 
                        ? `I've created an approved image based on: "${imageDescription}"`
                        : `I've created an image based on: "${imageDescription}" (note: some quality issues might remain)`,
                      image: data.finalImage,
                      timestamp: Date.now()
                    }]);
                    
                    // Store the total cost
                    if (data.totalCost) {
                      setTotalCost(data.totalCost);
                    }
                    
                    // If the image was approved, generate persona-optimized variations
                    if (data.isApproved) {
                      await generatePersonaOptimizations(data.finalImage, imageDescription);
                    }
                    
                    setIsLoading(false);
                    break;
                    
                  case 'error':
                    setGenerationLog(prev => [...prev, {
                      type: 'error',
                      message: `Sorry, there was an error generating the image: ${data.error}`,
                      timestamp: Date.now()
                    }]);
                    setIsLoading(false);
                    break;
                }
              } catch (error) {
                console.error('Error parsing SSE data:', error, line);
              }
            }
          }
        }
        
      } catch (error) {
        setGenerationLog(prev => [...prev, {
          type: 'error',
          message: `Sorry, there was an error generating the image: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: Date.now()
        }]);
        setIsLoading(false);
      }
    } else {
      // Mock agent thinking and response for other queries
      setGenerationLog(prev => [...prev, {
        type: 'status',
        message: 'Analyzing the question... Let me think about this step by step...',
        timestamp: Date.now()
      }]);
      
      setTimeout(() => {
        setGenerationLog(prev => [...prev, {
          type: 'result',
          message: 'This is the agent\'s response after thinking about your prompt.',
          timestamp: Date.now()
        }]);
        setIsLoading(false);
      }, 2000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Submit form when Enter is pressed without Shift key
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const generatePersonaOptimizations = async (approvedImageData: string, promptText: string) => {
    try {
      // Add status to log
      setGenerationLog(prev => [...prev, {
        type: 'status',
        message: 'Generating persona-optimized variations...',
        timestamp: Date.now()
      }]);
      
      // Call API endpoint to generate persona-specific optimizations
      const response = await fetch('/api/optimize-for-personas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          originalImage: approvedImageData, 
          prompt: promptText,
          personas: techPersonas.map(p => ({ id: p.id, name: p.name, bio: p.bio }))
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Add the variations to the log - prevent duplicate message
      setGenerationLog(prev => [...prev, {
        type: 'personaVariations',
        personaVariations: data.variations,
        timestamp: Date.now()
      }]);
    } catch (error) {
      setGenerationLog(prev => [...prev, {
        type: 'error',
        message: `Error generating persona variations: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      }]);
    }
  };

  // Add function to handle opening the edit modal
  const handleEditPersona = (persona: {id: string, name: string, image: string, bio: string}) => {
    setEditingPersona(persona);
    setIsEditModalOpen(true);
  };

  // Add function to save edited persona
  const savePersonaBio = (newBio: string) => {
    if (!editingPersona) return;
    
    setTechPersonas(personas => personas.map(persona => 
      persona.id === editingPersona.id 
        ? { ...persona, bio: newBio } 
        : persona
    ));
    
    setIsEditModalOpen(false);
    setEditingPersona(null);
  };

  return (
    <div className="min-h-screen w-full bg-white flex flex-col text-black">
      {/* Add global styles */}
      <style jsx global>{globalStyles}</style>
      
      <div className="p-2 max-w-3xl mx-auto w-full flex flex-col h-screen text-black justify-start pt-24">
        
        {/* Tech Personas Display - More Compact */}
        <div className="mb-2 flex overflow-x-auto gap-2 justify-center py-1">
          {techPersonas.map(persona => (
            <div key={persona.id} 
                 className="flex-shrink-0 tooltip cursor-pointer" 
                 title={persona.bio}
                 onClick={() => handleEditPersona(persona)}>
              <img 
                src={persona.image} 
                alt={persona.name} 
                className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 hover:border-purple-500 transition-all"
                onError={(e) => {
                  e.currentTarget.src = '/next.svg';
                }}
              />
            </div>
          ))}
        </div>
        
        {/* Generation Log - More Compact */}
        <div className="h-[50vh] overflow-y-auto mb-2 p-1 border border-gray-200 rounded-lg bg-gray-50">
          {generationLog.length === 0 ? (
            <div className="text-center text-gray-500 py-3 text-sm">
              Generation logs will appear here. Try creating an image!
            </div>
          ) : (
            <div className="space-y-2">
              {generationLog.map((entry, index) => (
                <div key={index} className={`p-2 rounded-lg text-black ${
                  entry.type === 'error' ? 'bg-red-50 border border-red-200' : 
                  entry.type === 'result' ? 'bg-white border-2 border-blue-200 shadow-sm' : 
                  entry.type === 'evaluation' ? 'bg-yellow-50 border border-yellow-200' :
                  entry.type === 'personaVariations' ? 'bg-purple-50 border-2 border-purple-200 shadow-md' :
                  'bg-white border border-gray-200'
                }`}>
                  <div className="flex items-center mb-1">
                    <div className={`w-2 h-2 rounded-full mr-2 ${
                      entry.type === 'status' ? 'bg-blue-400' :
                      entry.type === 'image' ? 'bg-green-400' :
                      entry.type === 'evaluation' ? 'bg-yellow-400' :
                      entry.type === 'result' ? 'bg-purple-400' :
                      entry.type === 'personaVariations' ? 'bg-pink-400' :
                      'bg-red-400'
                    }`}></div>
                    <div className="text-xs text-gray-500">
                      {entry.type === 'status' ? 'Processing' :
                       entry.type === 'image' ? `Generated Image (Step ${entry.step})` :
                       entry.type === 'evaluation' ? `Evaluation (Step ${entry.step})` :
                       entry.type === 'result' ? 'Final Result' :
                       entry.type === 'personaVariations' ? 'Optimized Generation' :
                       'Error'}
                    </div>
                    <div className="text-xs text-gray-400 ml-auto">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  
                  {entry.message && (
                    <div className={`text-xs mb-1 text-black ${
                      entry.type === 'evaluation' ? 'font-medium p-1 bg-yellow-50 rounded border-l-2 border-yellow-300' : ''
                    }`}>
                      {entry.type === 'evaluation' && <div className="text-xs font-bold mb-1 text-yellow-700">AI EVALUATION:</div>}
                      {entry.type === 'evaluation' ? (
                        <div className="whitespace-pre-line">
                          {entry.message.replace(/(\d+\.)\s/g, '\n$1 ').trim()}
                        </div>
                      ) : entry.message}
                    </div>
                  )}
                  
                  {entry.image && (
                    <div className="flex justify-center mt-1">
                      <img 
                        src={entry.image} 
                        alt={`Image ${entry.step || ''}`} 
                        className="rounded max-w-full max-h-48 object-contain"
                      />
                    </div>
                  )}

                  {entry.type === 'personaVariations' && entry.personaVariations && (
                    <div className="mt-2">
                      <div className="text-xs font-medium mb-2">Here are optimized variations for each persona:</div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {entry.personaVariations.map((variation, i) => {
                          // Find the matching persona to get the avatar image
                          const persona = techPersonas.find(p => p.id === variation.personaId);
                          return (
                            <div key={i} className="flex flex-col items-center transform transition-all duration-500 hover:scale-105 animate-fadeIn" 
                                 style={{animationDelay: `${i * 150}ms`}}>
                              <div className="relative">
                                <img 
                                  src={variation.image} 
                                  alt={`Optimized for ${variation.personaName}`} 
                                  className="w-full h-auto object-contain rounded-lg shadow-md border border-gray-200"
                                  onError={(e) => {
                                    e.currentTarget.src = '/next.svg';
                                  }}
                                />
                                {/* Persona avatar overlay */}
                                <div className="absolute -top-2 -left-2 w-8 h-8 rounded-full border-2 border-white shadow-md bg-white">
                                  <img 
                                    src={persona?.image || '/next.svg'} 
                                    alt={variation.personaName}
                                    className="w-full h-full rounded-full object-cover"
                                  />
                                </div>
                              </div>
                              <div className="text-xs font-medium text-center mt-1 truncate w-full">{variation.personaName}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={logEndRef} /> {/* Empty div for scrolling to end */}
            </div>
          )}
        </div>
        
        {/* Prompt Search Box - Fixed at Bottom */}
        <div className="sticky bottom-0 bg-white pt-1">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Create an image"
              className="w-full p-1.5 border border-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-black text-xs"
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
            <button 
              type="button"
              onClick={handleSubmit}
              disabled={isLoading}
              className={`absolute right-2 top-1/2 transform -translate-y-1/2 text-black ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
              {isLoading ? (
                <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              )}
            </button>
          </div>
          <div className="text-xs text-gray-500 mt-1 text-right">
            Total cost: ${totalCost}
          </div>
        </div>

        {/* Add Persona Edit Modal */}
        {isEditModalOpen && editingPersona && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-4 max-w-md w-full mx-2 shadow-2xl">
              <div className="flex items-center gap-3 mb-3">
                <img 
                  src={editingPersona.image} 
                  alt={editingPersona.name} 
                  className="w-12 h-12 rounded-full object-cover border-2 border-purple-500"
                  onError={(e) => {
                    e.currentTarget.src = '/next.svg';
                  }}
                />
                <h3 className="font-bold text-lg">{editingPersona.name}</h3>
              </div>
              
              <label className="block text-sm font-medium mb-1">Edit Persona Bio:</label>
              <textarea 
                className="w-full p-2 border border-gray-300 rounded-md mb-3 min-h-[150px] text-sm"
                value={editingPersona.bio}
                onChange={(e) => setEditingPersona({...editingPersona, bio: e.target.value})}
              />
              
              <div className="flex justify-end gap-2">
                <button 
                  onClick={() => setIsEditModalOpen(false)} 
                  className="px-3 py-1 bg-gray-200 rounded-md text-sm hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => savePersonaBio(editingPersona.bio)} 
                  className="px-3 py-1 bg-purple-600 text-white rounded-md text-sm hover:bg-purple-700 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}