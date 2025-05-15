export interface Persona {
  id: string;
  name: string;
  image: string;
  bio: string;
}

export interface VariationElement {
  id: string;
  type: string;
  before: string;
  after: string;
}

export interface PersonaVariation {
  persona: Persona;
  analysis: string;
  variations: VariationElement[];
} 