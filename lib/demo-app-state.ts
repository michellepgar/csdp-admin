import type { AppState } from "@/lib/app-state";

/* Fake, self-contained sample data for the login page's "See a demo"
   link -- deliberately never touches the real Supabase project, so a
   visitor poking around the demo can't see (or accidentally trigger a
   write against) any real school's actual data. getCurrentUser() and
   fetchAppState() (lib/supabase/server.ts, lib/fetch-app-state.ts)
   both short-circuit to this fixture + a fake "Jane" user whenever the
   demo-mode cookie is set, instead of doing their normal Supabase
   calls at all.

   Kept intentionally small -- just enough that every page has
   something to show, not a full realistic dataset. */

export const DEMO_USER_EMAIL = "jane@demo.csdp-tracker.local";
export const DEMO_USER_NAME = "Jane";

const SCHOOL_ANGELO = "1";
const SCHOOL_BAKER = "2";

export const DEMO_APP_STATE: AppState = {
  schools: [
    { id: SCHOOL_ANGELO, name: "Angelo Elementary School", website: "www.angeloelementary.edu", phone: "508-555-0101", fax: "508-555-0102", hours: "K-5 Hours: 9:00 a.m. - 3:15 p.m." },
    { id: SCHOOL_BAKER, name: "Baker Middle School", website: "www.bakermiddle.edu", phone: "508-555-0201" },
  ],
  vas: [
    { id: "demo-jane", name: DEMO_USER_NAME, email: DEMO_USER_EMAIL, admin: true, color: "#0ea5e9" },
    { id: "demo-john", name: "John", email: "john@demo.csdp-tracker.local", color: "#f97316" },
  ],
  schoolData: {
    [SCHOOL_ANGELO]: {
      vaAssigned: DEMO_USER_NAME,
      tasks: [
        { id: "t1", category: "Initial", fileName: "Q3-enrollment-report.xlsx", status: "In Progress", vaAssigned: [DEMO_USER_NAME], createdAt: new Date().toISOString() },
        { id: "t2", category: "Encoding & Uploading (Consent & SDF)", fileName: "consent-forms-batch-1.pdf", count: "42", status: "Completed", vaAssigned: ["John"], createdAt: new Date().toISOString() },
      ],
      emailTracker: [
        { id: "e1", description: "Waiting on updated enrollment counts from front desk", status: "Waiting on Them", addedBy: DEMO_USER_NAME, createdAt: new Date().toISOString() },
      ],
    },
    [SCHOOL_BAKER]: {
      vaAssigned: "John",
      tasks: [
        { id: "t3", category: "Follow up", fileName: "follow-up-visit-notes.docx", status: "Paused", vaAssigned: [], createdAt: new Date().toISOString() },
      ],
    },
  },
  checklistTemplate: [
    { id: "c1", description: "Beginning Of Year Email" },
    { id: "c2", description: "Drop Off Email" },
    { id: "c3", description: "Pick Up Form Email" },
  ],
  checklistProgress: {
    [`${SCHOOL_ANGELO}:c1`]: { status: "Done", checkedBy: DEMO_USER_NAME },
  },
  taskCategories: [
    { id: "cat1", name: "Encoding & Uploading (Consent & SDF)" },
    { id: "cat2", name: "Initial" },
    { id: "cat3", name: "Follow up" },
  ],
  contactGroups: [
    {
      id: "g1",
      name: "Elementary School",
      rows: [
        { id: "r1", school: "Angelo Elementary School", principal: "Pat Rivera", principalEmail: "privera@angeloelementary.edu", frontDesk: "Front Desk", frontDeskEmail: "frontdesk@angeloelementary.edu" },
      ],
    },
    {
      id: "g2",
      name: "Middle School",
      rows: [
        { id: "r2", school: "Baker Middle School", principal: "Sam Lee", principalEmail: "slee@bakermiddle.edu" },
      ],
    },
  ],
  nurseLeader: { name: "Alex Chen", email: "achen@demo.csdp-tracker.local" },
  distributionGroups: [
    {
      id: "dg1",
      name: "Elementary School",
      rows: [
        {
          id: "dr1",
          school: "Angelo Elementary School",
          enrolled: "312",
          distributed: true,
          contactPerson: "Pat Rivera",
          breakdown: { regular: { engSpn: 60, porFr: 5, hc: 2 }, launch: { engSpn: 0, porFr: 0, hc: 0 }, crr: { engSpn: 0, porFr: 0, hc: 0 } },
        },
      ],
    },
  ],
  eodReports: [
    { id: "eod1", author: DEMO_USER_NAME, date: new Date().toISOString().slice(0, 10), timeIn: "8:00 AM", timeOut: "4:00 PM", totalHours: "8", tasks: ["Reviewed consent forms for Angelo Elementary"], createdAt: new Date().toISOString() },
  ],
  issues: [
    { id: "i1", type: "software_issue", reportedBy: DEMO_USER_NAME, status: "Open", createdAt: new Date().toISOString(), description: "Sample issue for the demo -- upload button was slow to respond." },
  ],
  issueCategories: [],
  emailTemplates: [
    { id: "et1", name: "Beginning of Year", category: "General", subject: "Welcome back!", body: "Hi {{principal}},\n\nWe're excited to kick off this school year..." },
  ],
  suggestions: [
    { id: "s1", text: "Sample suggestion -- add a dark mode toggle (already done!)", author: "John", createdAt: new Date().toISOString(), status: "Added" },
  ],
  generalNotes: [
    { id: "n1", text: "Sample announcement: this is a demo account with made-up data.", author: DEMO_USER_NAME, createdAt: new Date().toISOString() },
  ],
  privateNotes: [],
  otherContacts: [
    { id: "oc1", name: "District Office", organization: "School District", email: "info@demo-district.edu", phone: "508-555-0900" },
  ],
  accessRequests: [],
  generalTasks: [
    { id: "gt1", category: "Admin", description: "September payroll reconciliation", status: "In Progress", vaAssigned: [DEMO_USER_NAME], createdAt: new Date().toISOString() },
    { id: "gt2", category: "Training", description: "New-hire onboarding training", status: "", vaAssigned: [], createdAt: new Date().toISOString() },
  ],
};
