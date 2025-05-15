import { useState } from 'react';

interface Persona {
  id: string;
  name: string;
  image: string;
  bio: string;
}

interface TechPersonasProps {
  personas: Persona[];
  onPersonaUpdate: (updatedPersona: Persona) => void;
}

export default function TechPersonas({ personas, onPersonaUpdate }: TechPersonasProps) {
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleEditPersona = (persona: Persona) => {
    setEditingPersona(persona);
    setIsEditModalOpen(true);
  };

  const savePersonaBio = (newBio: string) => {
    if (!editingPersona) return;
    
    onPersonaUpdate({
      ...editingPersona,
      bio: newBio
    });
    
    setIsEditModalOpen(false);
    setEditingPersona(null);
  };

  return (
    <div className="mb-4">
      <div className="flex flex-col items-center">
        <h2 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          YOUR CUSTOMER PERSONAS
        </h2>
      </div>
      <div className="flex gap-6 justify-center py-4 flex-wrap">
        {personas.map(persona => (
          <div
            key={persona.id}
            className="bg-white rounded-2xl shadow-lg p-6 w-[350px] flex flex-col items-start relative transition-all hover:shadow-xl"
          >
            <div className="flex items-center gap-4 mb-3 w-full">
              <img
                src={persona.image}
                alt={persona.name}
                className="w-16 h-16 rounded-full object-cover border-4 border-purple-400 shadow-sm"
                onError={(e) => {
                  e.currentTarget.src = '/next.svg';
                }}
              />
              <div className="flex flex-col">
                <span className="text-xl font-bold text-gray-900 leading-tight">{persona.name}</span>
                <span className="text-sm text-gray-500 mt-0.5">Click to edit bio</span>
              </div>
            </div>
            <div className="text-gray-700 text-base mb-6 min-h-[72px] w-full">
              {persona.bio.length > 120 ? persona.bio.slice(0, 120) + '...' : persona.bio}
            </div>
            <button
              onClick={() => handleEditPersona(persona)}
              className="w-full py-3 bg-purple-100 text-purple-700 font-semibold rounded-xl text-base hover:bg-purple-200 transition-colors mt-auto"
            >
              Edit Bio
            </button>
          </div>
        ))}
      </div>

      {/* Persona Edit Modal */}
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
  );
} 