/**
 * Posts the demonstration sale: one post on the chosen Page, then one comment per lot under it.
 * Progress is saved after every step, so a run that stops partway finishes the rest when it is
 * pressed again, and never posts the sale twice. Nothing here runs unless a screen calls it from a
 * button the seller pressed.
 */
import { DEMO_SALE, lotComment, type DemoProgress, type MetaPage } from '../core/metaDemo';
import { createComment, createPost } from './metaGraph';

export async function runDemoSale(
  page: MetaPage,
  start: DemoProgress | null | undefined,
  save: (progress: DemoProgress) => Promise<void> | void,
  onStep?: (step: 'post' | { commented: number }) => void,
): Promise<DemoProgress> {
  let progress: DemoProgress;
  if (start?.postId) {
    progress = start;
  } else {
    onStep?.('post');
    progress = { postId: await createPost(page, DEMO_SALE.post), commented: 0 };
    await save(progress);
  }
  for (let i = progress.commented; i < DEMO_SALE.lots.length; i += 1) {
    onStep?.({ commented: i });
    await createComment(page, progress.postId, lotComment(DEMO_SALE.lots[i]));
    progress = { postId: progress.postId, commented: i + 1 };
    await save(progress);
  }
  return progress;
}
