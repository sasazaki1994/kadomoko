import type { PetState, RelationshipNote } from './types';

export function buildRelationshipNote(pet: PetState): RelationshipNote {
  const label = (() => {
    if ((pet.personality === 'moody' || pet.personality === 'sulky') && pet.vitals.affection >= 20) return '気まぐれな小さな相棒';
    if ((pet.careStats.playCount >= 2 || pet.personality === 'energetic') && pet.vitals.affection >= 25) return 'よく遊ぶ小さな相棒';
    if ((pet.careStats.restCount >= 2 || pet.personality === 'relaxed') && pet.vitals.affection >= 25) return '休むのが上手な相棒';
    if (pet.vitals.affection >= 70 && (pet.personality === 'calm' || pet.personality === 'sweet')) return '静かに近くにいる相棒';
    return '少しずつなじんできた相棒';
  })();
  return { label, description: '近くにいることに慣れてきた。' };
}
