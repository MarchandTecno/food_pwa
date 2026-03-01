import { mapDatabaseError } from './errors';

export async function executeDbOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const mappedError = mapDatabaseError(error);
    if (mappedError) {
      throw mappedError;
    }

    throw error;
  }
}
