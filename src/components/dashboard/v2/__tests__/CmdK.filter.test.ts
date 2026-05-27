import { filterActions, type CmdAction } from '../CmdK';

const actions: CmdAction[] = [
  { kw: '+0.5h temporal', label: 'Log +0.5h Temporal', hint: 'temp 0.5', icon: '⏱', accent: '#000', run: () => {} },
  { kw: '+1h temporal',   label: 'Log +1h Temporal',   hint: 'temp 1',   icon: '⏱', accent: '#000', run: () => {} },
  { kw: '+gen generated', label: '+ Generated $2,000', hint: '$ gen',    icon: '$', accent: '#000', run: () => {} },
  { kw: 'reflect t3t',    label: 'Open reflection',    hint: '⌘R',       icon: '❋', accent: '#000', run: () => {} },
];

describe('filterActions', () => {
  it('returns the first 8 actions when the query is empty', () => {
    expect(filterActions(actions, '').length).toBe(actions.length);
  });

  it('matches against the keyword string', () => {
    const result = filterActions(actions, 'temp');
    expect(result.map((a) => a.label)).toEqual([
      'Log +0.5h Temporal',
      'Log +1h Temporal',
    ]);
  });

  it('matches against the visible label', () => {
    const result = filterActions(actions, 'generated');
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('+ Generated $2,000');
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterActions(actions, 'totally-no-match-here')).toEqual([]);
  });

  it('is case-insensitive', () => {
    expect(filterActions(actions, 'REFLECT').map((a) => a.label)).toEqual([
      'Open reflection',
    ]);
  });
});
