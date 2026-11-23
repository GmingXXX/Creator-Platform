import {advanceBackground} from '../domain/background-generation';
import {useEffect} from 'react';
import {useStudio} from '../domain/store';
import {advanceAIRun,isRealModel,stopInactiveAI} from '../domain/ai-run';
import { needsBackgroundSelection } from '../domain/generation-resource';

export function RunEngine() {
  useEffect(() => {
    const timer = setInterval(() => {
      const state = useStudio.getState();
      stopInactiveAI();
      for (const run of state.runs) {
        if(run.backgroundDraft?.status==='pending')void advanceBackground(run.id);
        if (run.status !== 'running') continue;
        if(isRealModel(run.model)){void advanceAIRun(run.id);continue;}
        if (run.step >= 1 && needsBackgroundSelection(run)) {
          state.updateRun(run.id, { status:'waiting', step:2 });
          continue;
        }
        if (run.step < 5) {
          state.updateRun(run.id, { step:run.step + 1 });
          continue;
        }
        try {
          state.completeRun(run.id);
        } catch (error) {
          state.updateRun(run.id, { status:'failed', error:error instanceof Error ? error.message : '这次创作没有完成，已保留需求，请重试。' });
        }
      }
    }, 1100);
    return () => clearInterval(timer);
  }, []);
  return null;
}
