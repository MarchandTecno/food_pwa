import { GraphQLError } from 'graphql';
import { executeDbOperation } from '../../src/database/operations';
import { mapDatabaseError } from '../../src/database/errors';

jest.mock('../../src/database/errors', () => ({
  mapDatabaseError: jest.fn(),
}));

const mapDatabaseErrorMock = mapDatabaseError as jest.MockedFunction<typeof mapDatabaseError>;

describe('database/operations', () => {
  beforeEach(() => {
    mapDatabaseErrorMock.mockReset();
  });

  it('returns operation result when successful', async () => {
    const result = await executeDbOperation(async () => ({ ok: true }));
    expect(result).toEqual({ ok: true });
    expect(mapDatabaseErrorMock).not.toHaveBeenCalled();
  });

  it('throws mapped GraphQL error when mapDatabaseError returns one', async () => {
    const dbFailure = new Error('db failure');
    const mapped = new GraphQLError('BAD_USER_INPUT: Invalid input: database validation failed', {
      extensions: { code: 'BAD_USER_INPUT' },
    });

    mapDatabaseErrorMock.mockReturnValue(mapped);

    await expect(
      executeDbOperation(async () => {
        throw dbFailure;
      }),
    ).rejects.toBe(mapped);

    expect(mapDatabaseErrorMock).toHaveBeenCalledWith(dbFailure);
  });

  it('rethrows original error when mapDatabaseError returns null', async () => {
    const original = new Error('original');
    mapDatabaseErrorMock.mockReturnValue(null);

    await expect(
      executeDbOperation(async () => {
        throw original;
      }),
    ).rejects.toBe(original);
  });
});
