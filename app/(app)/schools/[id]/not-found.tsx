import { PageBody } from "@/components/page-body";
import { NotFoundMessage } from "@/components/not-found-message";

export default function SchoolNotFound() {
  return (
    <PageBody>
      <NotFoundMessage title="This school isn't in the tracker anymore" detail="It may have been removed, or the link is out of date. Pick a school from the sidebar to keep going." />
    </PageBody>
  );
}
