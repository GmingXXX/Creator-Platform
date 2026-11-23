import {motion} from 'motion/react';
import {AlertCircle, Check, Circle, LoaderCircle, Pause} from 'lucide-react';
import type {Run} from '../../domain/types';

export type RunActivity = {step: 0 | 2 | 3; label: string};

const stages = ['理解创作需求', '匹配素材', '确认创作资源', '编排内容与交互', '检查布局与体验', '准备创作成果'];

export function RunProgress({run, activity, pausedLabel}: {run: Run; activity?: RunActivity; pausedLabel: string}) {
  const complete = run.status === 'complete';
  const step = activity?.step ?? (run.status === 'waiting' && run.aiPlan?.mode !== 'discuss' ? 2 : run.step);
  const running = run.status === 'running' || !!activity;
  const stateLabel = running ? '进行中' : run.status === 'failed' ? '待重试' : run.status === 'stopped' ? pausedLabel : '待确认';

  return <section aria-label="创作进度">
    <ol className="run-stage-list">
      {stages.map((stage, index) => {
        const passed = complete || index < step;
        const current = !complete && index === step;
        const Icon = passed ? Check : !current ? Circle : running ? LoaderCircle : run.status === 'failed' ? AlertCircle : run.status === 'stopped' ? Pause : Circle;
        return <motion.li
          key={stage}
          layout
          initial={{opacity: 0.72}}
          animate={{opacity: passed || current ? 1 : 0.56}}
          transition={{duration: 0.2}}
          className={`run-stage${passed ? ' done' : current ? ' current' : ''}`}
          aria-current={current ? 'step' : undefined}
          data-running={current && running}
        >
          <span className="run-stage-marker"><Icon size={14} aria-hidden="true" className={current && running ? 'spinner' : undefined}/></span>
          <span className="run-stage-label">{stage}{index === 1 && run.model === 'demo' ? '（演示）' : ''}</span>
          {passed && <small>已完成</small>}
          {current && <small className="run-stage-status" role="status">{stateLabel}</small>}
        </motion.li>;
      })}
    </ol>
    {activity && <p className="run-stage-detail" role="status">{activity.label}</p>}
  </section>;
}
