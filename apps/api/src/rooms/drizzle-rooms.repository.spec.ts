import { getTableColumns, gte } from 'drizzle-orm';
import { rooms } from '../db/schema';
import { DrizzleRoomsRepository } from './drizzle-rooms.repository';

// The controller spec binds a repository double, so it can never see the SQL this
// class builds. What matters here is the one branch that is easy to get wrong:
// "no filter" must drop the WHERE clause entirely rather than compare against
// undefined, which Postgres would answer with zero rows.
jest.mock('../db/connection', () => ({ getConnection: jest.fn() }));

const { getConnection } = jest.requireMock<{ getConnection: jest.Mock }>('../db/connection');

/** Minimal stand-in for `db.select(...).from(...).where(...).orderBy(...)`. */
function captureQuery() {
  const captured: { columns?: unknown; where?: unknown; orderBy?: unknown[] } = {};
  const orderBy = jest.fn((...args: unknown[]) => {
    captured.orderBy = args;
    return Promise.resolve([]);
  });
  const where = jest.fn((condition: unknown) => {
    captured.where = condition;
    return { orderBy };
  });
  getConnection.mockReturnValue({
    db: {
      select: (columns: unknown) => {
        captured.columns = columns;
        return { from: () => ({ where }) };
      },
    },
  });
  return captured;
}

describe('DrizzleRoomsRepository.listRooms', () => {
  afterEach(() => {
    getConnection.mockReset();
  });

  it('builds no WHERE clause when no minimum capacity is requested', async () => {
    const captured = captureQuery();

    await new DrizzleRoomsRepository().listRooms();

    expect(captured.where).toBeUndefined();
  });

  it('builds a capacity condition when a minimum is requested', async () => {
    const captured = captureQuery();

    await new DrizzleRoomsRepository().listRooms(6);

    // Comparing against the condition the query is supposed to build proves both
    // the column and the caller's number landed in it.
    expect(captured.where).toEqual(gte(rooms.capacity, 6));
  });

  it('orders by floor then name, so the list groups the way the design shows it', async () => {
    const captured = captureQuery();

    await new DrizzleRoomsRepository().listRooms();

    expect(captured.orderBy).toHaveLength(2);
  });

  it('never selects a column the room list does not render', async () => {
    const captured = captureQuery();

    await new DrizzleRoomsRepository().listRooms();

    expect(Object.keys(captured.columns as object).sort()).toEqual(Object.keys(getTableColumns(rooms)).sort());
  });
});
