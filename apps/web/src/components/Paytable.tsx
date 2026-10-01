import {
  ANDAR_BAHAR_RETURN,
  DICE_BET_LABEL,
  DICE_RETURN,
  POKER_HAND_LABEL,
  POKER_HANDS,
  POKER_PAYTABLE,
  ROULETTE_RETURN,
  SLOT_LEFT_PAIR_RETURN,
  SLOT_SYMBOL_INFO,
  SLOT_THREE_OF_A_KIND,
  TEEN_PATTI_HAND_LABEL,
  TEEN_PATTI_HANDS,
  TEEN_PATTI_WIN_RETURN,
  type GameId,
  type SlotSymbol,
} from '@casino/shared';
import { cn } from '../lib/format';

export function Paytable({ rows, highlight, className }: { rows: [string, string][]; highlight?: string; className?: string }) {
  return (
    <table className={cn('w-full text-sm', className)}>
      <caption className="sr-only">Paytable</caption>
      <tbody>
        {rows.map(([label, value]) => (
          <tr
            key={label}
            aria-current={highlight === label || undefined}
            className={cn('border-b border-white/[0.05] last:border-0', highlight === label && 'bg-gold-400/15 text-gold-200')}
          >
            <td className="py-1.5 pl-2 pr-3">{label}</td>
            <td className="tabular py-1.5 pr-2 text-right font-semibold text-fg">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const x = (n: number) => `${n}×`;

export function paytableFor(gameId: GameId): [string, string][] {
  switch (gameId) {
    case 'slots':
      return [
        ...(Object.entries(SLOT_THREE_OF_A_KIND) as [SlotSymbol, number][]).map(
          ([s, m]) => [`3 × ${SLOT_SYMBOL_INFO[s].label} ${SLOT_SYMBOL_INFO[s].glyph}`, x(m)] as [string, string],
        ),
        ['2 matching from the left', x(SLOT_LEFT_PAIR_RETURN)],
      ];
    case 'roulette':
      return [
        ['Red / Black / Odd / Even', `1:1 (${x(ROULETTE_RETURN.RED)})`],
        ['Dozen / Column', `2:1 (${x(ROULETTE_RETURN.DOZEN)})`],
        ['Single number', `35:1 (${x(ROULETTE_RETURN.NUMBER)})`],
      ];
    case 'blackjack':
      return [
        ['Blackjack (natural 21)', '3:2 (2.5×)'],
        ['Win', '1:1 (2×)'],
        ['Push (tie)', 'Stake returned'],
      ];
    case 'teen-patti':
      return [...TEEN_PATTI_HANDS].reverse().map((h) => [`Win with ${TEEN_PATTI_HAND_LABEL[h]}`, x(TEEN_PATTI_WIN_RETURN[h])] as [string, string]).concat([['Tie', 'Stake returned']]);
    case 'andar-bahar':
      return [
        ['Andar', `0.9:1 (${x(ANDAR_BAHAR_RETURN.ANDAR)})`],
        ['Bahar', `1:1 (${x(ANDAR_BAHAR_RETURN.BAHAR)})`],
      ];
    case 'dice':
      return (['DOWN', 'SEVEN', 'UP'] as const).map((t) => [DICE_BET_LABEL[t], x(DICE_RETURN[t])] as [string, string]);
    case 'poker':
      return [...POKER_HANDS]
        .reverse()
        .filter((h) => h !== 'NOTHING')
        .map((h) => [POKER_HAND_LABEL[h], x(POKER_PAYTABLE[h])] as [string, string]);
  }
}
