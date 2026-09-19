/* One shared, fixed stack in the lower-left corner that every pop-up
   toast (notification bell, new chat messages) renders into -- so two
   toasts arriving together stack neatly instead of drawing on top of
   each other. Sits just to the right of the sidebar when there is one
   (re-measured on every render, since the sidebar can collapse), and
   newest-first from the bottom corner up. Client-only. */
export function getToastRoot(): HTMLElement {
  let el = document.getElementById("toast-stack");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast-stack";
    el.className = "pointer-events-none fixed bottom-4 z-[70] flex w-[min(22rem,calc(100vw-2rem))] flex-col-reverse gap-2";
    document.body.appendChild(el);
  }
  const aside = document.querySelector("aside");
  const sidebarRight = aside ? Math.max(0, aside.getBoundingClientRect().right) : 0;
  el.style.left = `${sidebarRight + 16}px`;
  return el;
}
