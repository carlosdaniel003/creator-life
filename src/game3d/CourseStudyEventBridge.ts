interface CourseStudyRequestDetail {
  hours: 2 | 4;
  execute: () => { error: string | null; message?: string };
  complete: (result: { error: string | null; message?: string }) => void;
}

const install = (): void => {
  const container = document.getElementById("game-container");
  if (!container || container.dataset.courseStudyBridge === "true") return;
  container.dataset.courseStudyBridge = "true";

  container.addEventListener("creator-life-course-study-request", (event) => {
    const request = event as CustomEvent<CourseStudyRequestDetail>;
    const detail = request.detail;
    if (!detail?.execute || !detail?.complete) return;
    const result = detail.execute();
    detail.complete(result);
  });
};

install();
