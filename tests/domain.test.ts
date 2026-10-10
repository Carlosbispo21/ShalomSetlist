import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { weekKey, weekendDate, localDate, validBpm } from '../src/domain.ts';
describe('semana do culto em São Paulo', () => {
  it('mantém o repertório no domingo até meia-noite local', () => {
    assert.equal(weekKey(new Date('2026-10-12T02:59:59Z')), '2026-10-05');
    assert.equal(weekKey(new Date('2026-10-12T03:00:00Z')), '2026-10-12');
  });
  it('calcula sábado e domingo atravessando mês e ano', () => {
    assert.equal(weekendDate('2026-12-28', 'saturday').toISOString().slice(0,10), '2027-01-02');
    assert.equal(weekendDate('2026-12-28', 'sunday').toISOString().slice(0,10), '2027-01-03');
    assert.equal(localDate(new Date('2026-10-12T02:59:59Z')), '2026-10-11');
  });
});
it('limita o metrônomo a valores utilizáveis', () => {
  assert.equal(validBpm(0),80); assert.equal(validBpm(999),240); assert.equal(validBpm(20),30);
});
