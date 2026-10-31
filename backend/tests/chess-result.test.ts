import {expect,it} from 'vitest';
import {playMove} from '../src/services/chess.js';
it('keeps the mating move and does not invent an engine reply after mate',async()=>{
 const result=await playMove({fen:'7k/8/5KQ1/8/8/8/8/8 w - - 0 1',move:'g6g7',difficulty:1});
 expect(result.gameOver).toBe(true);
 expect(result.gameResult).toBe('win');
 expect(result.playerMove).toBe('Qg7#');
 expect(result.engineMove).toBeNull();
 expect(result.fenAfter).toContain('6Q1');
});
