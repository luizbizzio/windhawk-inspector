import { parseMetadata } from './metadata';

/** Reject comparisons that cannot be tied to the same Windhawk mod ID. */
export function verifyComparableSources(current: {source:string}, previous: {source:string}, expectedModId?:string): void {
  const currentId = parseMetadata(current.source).id?.trim();
  const previousId = parseMetadata(previous.source).id?.trim();
  if (!currentId || !previousId) {
    throw new Error('Both sources need a Windhawk @id. You can only compare versions of the same mod.');
  }
  if (expectedModId && currentId!==expectedModId) {
    throw new Error(`The selected mod is ${expectedModId}, but its source declares ${currentId}.`);
  }
  if (currentId!==previousId) {
    throw new Error(`These sources belong to different mods (${currentId} and ${previousId}). Choose two versions with the same @id.`);
  }
  if (current.source===previous.source) {
    throw new Error('Both sources are identical. Select a different version to compare.');
  }
}
