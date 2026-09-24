/* A meeting logged from Your Plan, as one EOD-ready line:
   "Meeting with Dr. Lee - Weekly sync", "Meeting with Dr. Lee",
   "Meeting - Weekly sync", or just "Meeting". */
export function meetingLabel(withWhom: string, topic: string): string {
  const who = withWhom.trim().slice(0, 80);
  const about = topic.trim().slice(0, 120);
  return `${who ? `Meeting with ${who}` : "Meeting"}${about ? ` - ${about}` : ""}`;
}
