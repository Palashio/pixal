import { useState } from 'react';
import type { PersonaVariation } from '@/types/adCopy';

interface CopyVariationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  variations: PersonaVariation[];
  adImage?: string | null;
  productDescription?: string;
}

export default function CopyVariationsModal({ isOpen, onClose, variations, adImage, productDescription }: CopyVariationsModalProps) {
  const [selectedPersonaIndex, setSelectedPersonaIndex] = useState(0);
  const [isAdEnlarged, setIsAdEnlarged] = useState(false);

  if (!isOpen) return null;

  const currentVariation = variations[selectedPersonaIndex];
  const elements = currentVariation.variations;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-sm">
      {/* Enlarged Ad Modal */}
      {isAdEnlarged && adImage && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70" onClick={() => setIsAdEnlarged(false)}>
          <div className="relative" onClick={e => e.stopPropagation()}>
            <img src={adImage} alt="Enlarged Ad" className="max-w-[90vw] max-h-[90vh] rounded-2xl shadow-2xl border-4 border-white" />
            <button
              className="absolute top-2 right-2 bg-white/80 hover:bg-white text-gray-700 rounded-full p-2 shadow-md"
              onClick={() => setIsAdEnlarged(false)}
              aria-label="Close enlarged ad"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      <div className="bg-white rounded-2xl p-0 max-w-5xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto border border-gray-100 relative">
        {/* Close Button (X) at Top Right */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 z-20 bg-white/80 rounded-full p-2 shadow-md"
          aria-label="Close modal"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {/* Modal Title and Description */}
        <div className="px-6 pt-8 pb-2 border-b border-gray-100">
          <h2 className="text-2xl font-extrabold text-purple-800 mb-2">Persona-Optimized Ad Copy Variations</h2>
          <p className="text-gray-700 text-base mb-2 max-w-3xl">
            Below are AI-generated ad copy variations for your selected ad and product description, tailored for each customer persona. Use these insights to see how your messaging can be optimized for different audiences.
          </p>
        </div>
        {/* Ad Image and Product Description */}
        <div className="flex flex-col md:flex-row items-center gap-6 px-6 pt-6 pb-2 border-b border-gray-100">
          {adImage && (
            <div className="flex-shrink-0 cursor-zoom-in" onClick={() => setIsAdEnlarged(true)}>
              <img src={adImage} alt="Selected Ad" className="w-48 h-48 object-contain rounded-xl border border-gray-200 shadow-md bg-white transition-transform hover:scale-105" />
              <div className="text-xs text-center text-gray-500 mt-1">Click to enlarge</div>
            </div>
          )}
          {productDescription && (
            <div className="flex-1">
              <h3 className="text-lg font-bold text-purple-700 mb-2">Product Description</h3>
              <p className="text-gray-800 text-base bg-purple-50 rounded-lg p-4 border border-purple-100 shadow-sm whitespace-pre-line">{productDescription}</p>
            </div>
          )}
        </div>
        {/* Header with Persona Selector */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2 border-b border-gray-100">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {variations.map((variation, index) => (
              <button
                key={variation.persona.id}
                onClick={() => setSelectedPersonaIndex(index)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all font-semibold text-base
                  ${selectedPersonaIndex === index 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                <img 
                  src={variation.persona.image} 
                  alt={variation.persona.name} 
                  className="w-7 h-7 rounded-full object-cover border-2 border-current"
                  onError={(e) => {
                    e.currentTarget.src = '/next.svg';
                  }}
                />
                <span>{variation.persona.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Before/After Table for Ad Elements */}
        <div className="p-8">
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200 rounded-xl bg-gradient-to-br from-gray-50 to-white">
              <thead>
                <tr className="bg-gray-50 text-gray-800 text-sm font-bold">
                  <th className="px-4 py-3 border-b border-gray-200 text-left">Type</th>
                  <th className="px-4 py-3 border-b border-gray-200 text-left">Before</th>
                  <th className="px-4 py-3 border-b border-gray-200 text-left">After</th>
                </tr>
              </thead>
              <tbody>
                {elements.map((el) => (
                  <tr key={el.id} className="even:bg-white odd:bg-gray-50">
                    <td className="px-4 py-3 align-top border-b border-gray-100 text-sm text-gray-900 font-semibold">
                      {el.type}
                    </td>
                    <td className="px-4 py-3 align-top border-b border-gray-100 text-sm text-gray-800 whitespace-pre-line">
                      {el.before}
                    </td>
                    <td className="px-4 py-3 align-top border-b border-gray-100 text-sm text-purple-900 whitespace-pre-line">
                      {el.after}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
} 