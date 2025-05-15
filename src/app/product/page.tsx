'use client';

import { useState, useEffect } from 'react';
import TechPersonas from '@/components/TechPersonas';
import CopyVariationsModal from '@/components/CopyVariationsModal';
import type { PersonaVariation } from '@/types/adCopy';

// Pre-written product descriptions
const PRE_WRITTEN_DESCRIPTIONS = [
  {
    id: 1,
    title: 'Apple Watch Series 10',
    description: 'The latest Apple Watch with a thinner, lighter build, advanced health and fitness tracking, a larger always-on display, and seamless integration with iPhone. Perfect for anyone who wants to stay connected and healthy on the go.'
  },
  {
    id: 2,
    title: 'Jabra Elite 8 Active',
    description: 'Durable true wireless earbuds with adaptive active noise cancellation, secure fit, and up to 32 hours of battery life. Designed for athletes and music lovers who need great sound and sweatproof performance.'
  },
  {
    id: 3,
    title: 'Dr. Dennis Gross DRx SpectraLite FaceWare Pro',
    description: 'An FDA-cleared LED face mask that uses red and blue light therapy to reduce wrinkles, clear acne, and improve skin tone in just a few minutes a day.'
  },
  {
    id: 4,
    title: 'Charlotte Tilbury Pillow Talk Lipstick',
    description: 'A universally flattering, award-winning nude-pink lipstick that delivers a perfect, natural-looking pout. Loved by celebrities and makeup artists worldwide.'
  },
  {
    id: 5,
    title: 'Foreo Luna 4',
    description: 'A silicone facial cleansing brush that uses T-Sonic pulsations to deeply cleanse and massage the skin, removing 99% of dirt, oil, and makeup residue for a radiant complexion.'
  }
];

export default function ProductPage() {
  const [techPersonas, setTechPersonas] = useState<Array<{id: string, name: string, image: string, bio: string}>>([]);
  const [customDescription, setCustomDescription] = useState<string>('');
  const [selectedAd, setSelectedAd] = useState<number | 'upload' | null>(null);
  const [uploadedAdImage, setUploadedAdImage] = useState<string | null>(null);
  const [isVariationsModalOpen, setIsVariationsModalOpen] = useState(false);
  const [variations, setVariations] = useState<PersonaVariation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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

  const handlePersonaUpdate = (updatedPersona: {id: string, name: string, image: string, bio: string}) => {
    setTechPersonas(personas => personas.map(persona => 
      persona.id === updatedPersona.id ? updatedPersona : persona
    ));
  };

  const handleDescriptionSelect = (description: string) => {
    setCustomDescription(description);
  };

  const handleAdUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setUploadedAdImage(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateVariations = async () => {
    try {
      setIsLoading(true);
      let adImagePayload = {};
      if (selectedAd === 'upload' && uploadedAdImage) {
        adImagePayload = { uploadedAdImage };
      } else if (typeof selectedAd === 'number') {
        adImagePayload = { adImagePath: `/ads/image${selectedAd + 1}.png` };
      }

      const response = await fetch('/api/variate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personas: techPersonas,
          productDescription: customDescription,
          selectedAd,
          ...adImagePayload
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message);
      }
      setVariations(data.results);
      setIsVariationsModalOpen(true);
    } catch (error) {
      console.error('Error generating variations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Add a boolean to check if the form is ready
  const isReadyToGenerate = !!(customDescription && (typeof selectedAd === 'number' || (selectedAd === 'upload' && uploadedAdImage)));

  return (
    <div className="min-h-screen w-full bg-white flex flex-col text-black">
      {/* Bezel Logo Top Left */}
      <a 
        href="https://simulate.trybezel.com" 
        className="absolute top-4 left-4 flex items-center"
      >
        <img 
          src="/bezel.png" 
          alt="Bezel Logo"
          className="h-8 object-contain"
        />
      </a>

      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="flex flex-col items-center">
            <svg className="animate-spin h-16 w-16 text-purple-600 mb-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
            <span className="text-xl font-bold text-purple-700 animate-pulse">Generating Copy Variations, can take up to a minute...</span>
          </div>
        </div>
      )}
      <div className="p-2 max-w-6xl mx-auto w-full flex flex-col flex-1 text-black justify-start pt-16">
        {/* Header Card: Title + Info Box */}
        <div className="mb-10 p-0 md:p-0 border border-gray-200 rounded-2xl bg-white shadow-md max-w-3xl mx-auto w-full">
          <div className="px-6 pt-7 pb-2">
            <h1 className="text-3xl md:text-4xl font-extrabold text-center">
              <span className="text-gray-700">Bezel</span>
              <span className="text-gray-700"> – AI Ad Copy Generator</span>
            </h1>
          </div>
          <div className="px-6 pb-5">
            <div className="flex items-center gap-3 mb-2 justify-center">
              <svg className="h-6 w-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 20c4.418 0 8-3.582 8-8s-3.582-8-8-8-8 3.582-8 8 3.582 8 8 8z" /></svg>
              <span className="text-lg md:text-xl font-bold text-gray-800">How does this work?</span>
            </div>
            <ol className="list-decimal list-inside text-sm md:text-base text-gray-700 pl-2 space-y-1 max-w-2xl mx-auto">
              <li><span className="font-semibold">Peruse the personas</span> — we provide a base for the personas, modify if you need.</li>
              <li><span className="font-semibold">Enter your product description</span> — describe what you want new copy for.</li>
              <li><span className="font-semibold">Select an ad type for inspiration</span> or <span className="font-semibold">upload your own ad</span>.</li>
              <li><span className="font-semibold">Off to the races!</span> Generate new, persona-optimized copy in seconds.</li>
            </ol>
          </div>
          <div className="w-full h-px bg-gray-100" />
        </div>

        {/* Tech Personas Component */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-lg">1</div>
            <span className="text-xl font-bold text-purple-700">Your Customer Personas</span>
          </div>
          <TechPersonas 
            personas={techPersonas}
            onPersonaUpdate={handlePersonaUpdate}
          />
        </div>
        
        {/* Product Description Section */}
        <div className="mt-8 p-6 border-2 border-purple-200 rounded-2xl bg-gradient-to-br from-purple-50 via-white to-purple-100 shadow-lg mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-lg">2</div>
            <h2 className="text-xl font-bold text-purple-700 m-0">Product Description</h2>
          </div>
          
          {/* Pre-written Descriptions */}
          <div className="mb-4">
            <h3 className="text-sm font-medium mb-2">Choose from pre-written descriptions:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {PRE_WRITTEN_DESCRIPTIONS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleDescriptionSelect(item.description)}
                  className={`p-3 text-left rounded-2xl border-2 transition-all duration-150 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-400 group
                    ${customDescription === item.description
                      ? 'border-purple-600 bg-purple-100/80 shadow-lg scale-[1.03] text-purple-900'
                      : 'border-gray-200 bg-white hover:border-purple-400 hover:bg-purple-50/80 hover:shadow-md'}
                  `}
                >
                  <h4 className="font-bold text-sm mb-1 text-purple-800 group-hover:text-purple-900">{item.title}</h4>
                  <p className="text-xs text-gray-700 group-hover:text-purple-700 line-clamp-3">{item.description}</p>
                </button>
              ))}
            </div>
          </div>
          
          {/* Custom Description Input */}
          <div>
            <h3 className="text-base font-semibold mb-2 text-purple-700">Or write your own description:</h3>
            <textarea
              value={customDescription}
              onChange={(e) => setCustomDescription(e.target.value)}
              placeholder="Enter your product description here..."
              className={`w-full p-2 border-2 rounded-lg focus:ring-2 focus:ring-purple-400 focus:outline-none min-h-[100px] text-sm bg-white placeholder:text-purple-300 text-purple-900 transition-all duration-150
                ${customDescription ? 'border-purple-600 bg-purple-100/80 shadow-lg scale-[1.03]' : 'border-purple-200'}`}
            />
          </div>
        </div>

        {/* Ads Section */}
        <div className="mt-10 p-6 border-2 border-purple-200 rounded-2xl bg-white shadow-md mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-lg">3</div>
            <h2 className="text-2xl font-extrabold text-gray-800 tracking-tight m-0">Ads</h2>
          </div>
          <div className="mb-7 text-sm font-medium mb-2 text-gray-800 text-center">
            Select your ad copy inspiration, or upload your own
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-px bg-gray-200">
            {[1,2,3,4,5,6,7,8,9,10,11].map((num, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedAd(idx)}
                className={`h-56 w-full min-w-0 border border-gray-200 bg-white p-0 m-0 rounded-2xl flex items-stretch justify-stretch transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-purple-400 overflow-hidden
                  ${selectedAd === idx ? 'border-2 border-purple-500 bg-purple-50 z-10' : ''}`}
              >
                <img src={`/ads/image${num}.png`} alt={`Ad Placeholder ${num}`} className="w-full h-full object-cover rounded-2xl" />
              </button>
            ))}
            <label
              className={`h-56 w-full min-w-0 border border-gray-200 bg-white p-0 m-0 rounded-2xl flex flex-col items-center justify-center transition-all duration-150 cursor-pointer
                ${selectedAd === 'upload' ? 'border-2 border-purple-500 bg-purple-50 z-10' : ''}`}
              htmlFor="ad-upload"
              onClick={() => setSelectedAd('upload')}
            >
              {uploadedAdImage ? (
                <img src={uploadedAdImage} alt="Uploaded Ad" className="w-full h-full object-cover rounded-2xl" />
              ) : (
                <>
                  <svg className="h-16 w-16 text-purple-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M16 10l-4-4m0 0l-4 4m4-4v12" />
                  </svg>
                  <span className="text-xs text-purple-700 font-semibold">Upload Ad</span>
                </>
              )}
              <input
                id="ad-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAdUpload}
                onClick={e => e.stopPropagation()}
              />
            </label>
          </div>
        </div>

        {/* Generate Button */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={handleGenerateVariations}
            className={`px-8 py-4 rounded-xl font-bold text-lg transition-colors duration-200 shadow-lg hover:shadow-xl
              ${isReadyToGenerate ? 'bg-purple-600 text-white hover:bg-purple-700 cursor-pointer' : 'bg-gray-300 text-gray-400 cursor-not-allowed'}`}
            disabled={!isReadyToGenerate}
          >
            Generate Variations
          </button>
        </div>
      </div>

      {/* Copy Variations Modal */}
      <CopyVariationsModal
        isOpen={isVariationsModalOpen}
        onClose={() => setIsVariationsModalOpen(false)}
        variations={variations}
        adImage={selectedAd === 'upload' ? uploadedAdImage : (typeof selectedAd === 'number' ? `/ads/image${selectedAd + 1}.png` : undefined)}
        productDescription={customDescription}
      />
    </div>
  );
} 