/**
 * 苫米地式コーチングセッション ページ
 */

import { CoachingSession } from "../organisms/CoachingSession";
import { MainLayout } from "../templates/MainLayout";

export const CoachingPage = () => {
  return (
    <MainLayout>
      <CoachingSession />
    </MainLayout>
  );
};
