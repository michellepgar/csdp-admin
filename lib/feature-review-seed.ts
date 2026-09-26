/* The 24 starting cards for the CSDP visual aid's Feature Review board (from
   Michelle's feature list). Each picture is a placeholder named after its file
   in "D:\CSDP Data Mapping\Feature review\pictures"; the board's "Upload
   pictures" matches uploaded files to these names. All data in the pictures is
   made up. */
import type { ReviewSeedCard } from "./feature-review.ts";

export const FEATURE_REVIEW_STARTING_CARDS: ReviewSeedCard[] = [
  {
    "id": "suggest-patient",
    "area": "Create New Patient",
    "title": "Patient name suggestions while typing",
    "pictures": [
      {
        "file": "suggest-patient.png",
        "caption": "Typing “sa” in First Name lists existing patients with birthday, insurance and status"
      }
    ],
    "what": "While staff type a first or last name, existing patients with those letters are listed with their full name, date of birth, insurance and status (Active, Inactive or Archived). Clicking one cancels the new record and opens that patient's record. Deleted records are not suggested.",
    "why": "Stops the same child being entered twice, without having to search the Patients list first.",
    "how": [
      "Patients → + New Patient.",
      "Type “sa” in First Name.",
      "Click Sample Patient: their record opens and nothing new is created."
    ]
  },
  {
    "id": "suggest-guardian",
    "area": "Create New Patient",
    "title": "Guardian suggestions and phone search in any format",
    "pictures": [
      {
        "file": "suggest-guardian.png",
        "caption": "Typing “mar” suggests Maria Sample with email and main phone"
      },
      {
        "file": "phone-search.png",
        "caption": "Searching 555.010.1234 still finds (555) 010-1234"
      }
    ],
    "what": "Typing a guardian's name suggests existing guardians with their email and main phone; clicking one links them instead of adding them again. The guardian search also finds a phone number however it is typed (dots, dashes, spaces or no spaces).",
    "why": "One shared record per guardian, so siblings stay linked and contact details are updated in one place.",
    "how": [
      "On + New Patient, click + Guardian / Emergency Contact.",
      "Type “mar” in First Name and click Maria Sample.",
      "Or type 555.010.1234 in the search box and click Search."
    ]
  },
  {
    "id": "phone-format",
    "area": "Everywhere",
    "title": "Phone numbers saved as (###) ###-####",
    "pictures": [
      {
        "file": "guardians-tab.png",
        "caption": "Phone numbers shown in one format"
      },
      {
        "file": "merge-preview.png",
        "caption": "5550105555 typed on Create New Patient, saved as (555) 010-5555"
      }
    ],
    "what": "Any 10-digit phone number is saved as (###) ###-####, however it was typed. Incomplete numbers (as they sometimes come in on forms) are kept exactly as typed.",
    "why": "Numbers are easy to read and to search, and incomplete numbers are not lost.",
    "how": [
      "Create or edit a patient or guardian.",
      "Type a phone number as 5550109999 and save.",
      "It shows as (555) 010-9999."
    ]
  },
  {
    "id": "hidden-ids",
    "area": "Everywhere",
    "title": "Patient and Guardian IDs hidden on screen",
    "pictures": [
      {
        "file": "patients-list.png",
        "caption": "Patients list without an ID column"
      }
    ],
    "what": "Patient IDs and Guardian IDs are no longer shown on screens. They are still kept behind the scenes to link records.",
    "why": "The IDs are for the system only; staff find patients by name, birthday or insurance number.",
    "how": [
      "Open the Patients list and a patient record: no Patient ID is shown.",
      "Settings → Guardians: no Guardian ID column."
    ]
  },
  {
    "id": "no-examples",
    "area": "Create New Patient",
    "title": "No example text in empty boxes",
    "pictures": [
      {
        "file": "new-patient-empty.png",
        "caption": "Empty boxes on Create New Patient"
      }
    ],
    "what": "Data-entry boxes no longer show grey example text.",
    "why": "Example text could make staff think a box was already filled in.",
    "how": [
      "Patients → + New Patient: the boxes are empty."
    ]
  },
  {
    "id": "list-menu",
    "area": "Patients list",
    "title": "⋮ menu on the Patients list",
    "pictures": [
      {
        "file": "patients-menu.png",
        "caption": "Mark Inactive, Archive, Merge Patient Record, Delete"
      }
    ],
    "what": "Each row has a ⋮ menu with Mark Inactive / Active, Archive Patient, Merge Patient Record and Delete Patient (and Restore for archived or deleted records).",
    "why": "Common record actions without opening the record.",
    "how": [
      "Patients list → click ⋮ at the end of a row."
    ]
  },
  {
    "id": "filters",
    "area": "Patients list",
    "title": "Several values per filter",
    "pictures": [
      {
        "file": "filters.png",
        "caption": "Grade 1 and Grade 3 ticked together"
      }
    ],
    "what": "Schools, Grades, School Years, Teachers and Status filters let staff tick more than one value.",
    "why": "For example, one visit covers Grades 1 and 3, or two schools share a day.",
    "how": [
      "Patients list → Grade Level.",
      "Tick Grade 1 and Grade 3: both show."
    ]
  },
  {
    "id": "search",
    "area": "Patients list",
    "title": "Search by name, date of birth or insurance number",
    "pictures": [
      {
        "file": "search-dob.png",
        "caption": "Searching 08/30/2016 finds Riley Demo"
      }
    ],
    "what": "The search box finds patients by name, date of birth or insurance number.",
    "why": "Staff often have a birthday or insurance number from a form rather than the exact spelling of a name.",
    "how": [
      "Patients list → type 08/30/2016 in the search box."
    ]
  },
  {
    "id": "archive",
    "area": "Patient record",
    "title": "Archive, Delete and Restore (with a log)",
    "pictures": [
      {
        "file": "archive-confirm.png",
        "caption": "Archive asks for an optional reason"
      },
      {
        "file": "archived.png",
        "caption": "Archived record with who, when and why, and Restore"
      }
    ],
    "what": "Archive hides a record from the Patients list; Delete marks it deleted. Nothing is erased: Restore puts it back. Each change is logged with who, when and the reason.",
    "why": "Old or duplicate records are out of the way, but nothing is lost by mistake.",
    "how": [
      "Open a patient → 🗄 Archive → type a reason → Archive.",
      "The banner shows the details; click ↺ Restore record to bring it back."
    ]
  },
  {
    "id": "merge",
    "area": "Patient record",
    "title": "Merge duplicate patient records",
    "pictures": [
      {
        "file": "merge-search.png",
        "caption": "Search all patient records for the duplicate"
      },
      {
        "file": "merge-preview.png",
        "caption": "Choose which details to keep; see what is added and what is left out"
      }
    ],
    "what": "Merge a duplicate into the record being kept. Staff search all records, choose which details to keep, and see what will be added (participations, documents, Teeth Chart entries) and what is left out because the kept record already has it.",
    "why": "Duplicates happen; merging keeps one complete record without copying the same information twice.",
    "how": [
      "Open a patient → ⇄ Merge (or ⋮ → Merge Patient Record on the list).",
      "Search by name, birthday or insurance number and pick the duplicate.",
      "Check the preview, then Merge."
    ]
  },
  {
    "id": "verified",
    "area": "Patient record",
    "title": "Verified insurance",
    "pictures": [
      {
        "file": "insurance-verify-confirm.png",
        "caption": "Verify asks for confirmation"
      },
      {
        "file": "insurance-verified.png",
        "caption": "✓ Verified with date and who"
      },
      {
        "file": "insurance-locked.png",
        "caption": "Provider, type and number locked"
      }
    ],
    "what": "An insurance can be marked Verified (date and staff shown). Its provider, type and number are then locked. A new insurance number is added as a new record; verifying it makes the old one Inactive.",
    "why": "Everyone can see the insurance was already checked, and a checked number cannot be changed by mistake.",
    "how": [
      "Open a patient → Insurances → Verify → Verify.",
      "Click ✎: the details are locked.",
      "Add a new insurance and verify it: the old one becomes Inactive."
    ]
  },
  {
    "id": "dob-lock",
    "area": "Patient record",
    "title": "Birthday locked once an insurance is verified",
    "pictures": [
      {
        "file": "dob-locked.png",
        "caption": "Birthday locked on Edit Patient"
      }
    ],
    "what": "When a patient has a verified insurance, their birthday cannot be changed on Edit Patient.",
    "why": "The birthday was checked together with the insurance.",
    "how": [
      "Verify an insurance for a patient.",
      "Click Edit Patient: Birthday shows 🔒 locked."
    ]
  },
  {
    "id": "teacher-box",
    "area": "Create New Patient",
    "title": "Teacher box shows the name only",
    "pictures": [
      {
        "file": "teacher-box.png",
        "caption": "Teacher box shows the name; school, grade and room fill in"
      }
    ],
    "what": "After picking a teacher, the box shows only the teacher's name. School, grade and room still fill in automatically.",
    "why": "Easier to read.",
    "how": [
      "+ New Patient → + Participation.",
      "Type “sample t” in Teacher and press Enter."
    ]
  },
  {
    "id": "teacher-transfer",
    "area": "Settings",
    "title": "Teacher transfers keep saved records as they are",
    "pictures": [
      {
        "file": "teacher-edit.png",
        "caption": "Teacher moved to Grade 4, room G205"
      },
      {
        "file": "teacher-saved.png",
        "caption": "Saved: records already saved keep their details"
      },
      {
        "file": "teacher-old-record.png",
        "caption": "The patient's saved participation still shows Grade 3, G101"
      }
    ],
    "what": "When a teacher changes school, grade or homeroom in Settings, participations already saved keep their school, grade and room. New participations use the new details. Old records show the teacher's current name.",
    "why": "Past school years stay accurate.",
    "how": [
      "Settings → Teachers → ✎ on Sample Teacher.",
      "Change Grade and Homeroom → Save.",
      "Open Sample Patient → Participations: unchanged."
    ]
  },
  {
    "id": "main-phone",
    "area": "Patient record",
    "title": "Guardian card shows only the main phone",
    "pictures": [
      {
        "file": "guardians-tab.png",
        "caption": "Card at the top shows the Main number; the Guardians tab lists all numbers"
      }
    ],
    "what": "The Parents/Guardians card at the top of the record shows only the main phone number. All numbers are still on the Guardians tab.",
    "why": "Staff call the right number first.",
    "how": [
      "Open Sample Patient: the card shows (555) 010-1234.",
      "Guardians tab: the work number is listed too."
    ]
  },
  {
    "id": "latest-top",
    "area": "Patient record",
    "title": "Latest records on top",
    "pictures": [
      {
        "file": "teacher-old-record.png",
        "caption": "Newest school year first"
      },
      {
        "file": "mixed-history.png",
        "caption": "Newest Chart History entries first"
      }
    ],
    "what": "Lists on the patient record show the most recently added entries first.",
    "why": "The newest information is usually what staff need.",
    "how": [
      "Open a patient → Participations, Insurances or Teeth Chart → Chart History."
    ]
  },
  {
    "id": "documents",
    "area": "Patient record",
    "title": "Documents tab keeps each patient's documents",
    "pictures": [
      {
        "file": "documents.png",
        "caption": "Documents tab (card view)"
      }
    ],
    "what": "The Documents tab lists each patient's documents with name, date and who added them. It stores the details, not the file itself.",
    "why": "Staff see which forms a patient has. (Storing the scanned file itself is a separate next step.)",
    "how": [
      "Open Sample Patient → Documents."
    ]
  },
  {
    "id": "grades",
    "area": "Settings",
    "title": "Grades: school levels and each school's grades",
    "pictures": [
      {
        "file": "grades.png",
        "caption": "School levels and their grades"
      },
      {
        "file": "grades-schools.png",
        "caption": "Each school's level decides its Grade list"
      }
    ],
    "what": "Settings → Grades lists school levels: Pre-K School, Elementary (Pre-K to Grade 5), Middle (6–8), High (9–12), Pre-K to Grade 12, and Adult Day Health. Each school is given a level, and its Grade lists offer only those grades.",
    "why": "Staff can only pick a grade the school actually has.",
    "how": [
      "Settings → Grades.",
      "Set a school's Level.",
      "Add a participation for that school: the Grade list follows."
    ]
  },
  {
    "id": "referrals",
    "area": "Teeth Chart",
    "title": "Several referrals on one date",
    "pictures": [
      {
        "file": "referrals-several.png",
        "caption": "Automatic TU2 and ORTHO on the same date"
      },
      {
        "file": "referrals-several-history.png",
        "caption": "Both saved in Chart History"
      }
    ],
    "what": "A date of service can have more than one referral, for example the automatic TU2 and ORTHO added by hand. Clicking a referral that is already on adds nothing and takes it off instead. TU0 (No Referral) never stands next to a real referral.",
    "why": "Children are sometimes referred for more than one reason.",
    "how": [
      "Open a patient → Teeth Chart, choose a provider.",
      "Click a tooth, then D: TU2 is added automatically.",
      "Click ORTHO: both show."
    ]
  },
  {
    "id": "auto-ref-off",
    "area": "Teeth Chart",
    "title": "Automatic referral can be taken off",
    "pictures": [
      {
        "file": "referral-auto-off.png",
        "caption": "TU2 taken off; note that the automatic referral is off for this date"
      },
      {
        "file": "referral-auto-off-history.png",
        "caption": "Chart History before TU2 was taken off"
      }
    ],
    "what": "Clicking the automatic referral takes it off, and it stays off for that date even when more is charted. Referrals can still be added by hand. Other dates are not affected.",
    "why": "Sometimes no referral is needed even with decay, for example a baby tooth about to fall out.",
    "how": [
      "After charting D (TU2 added), click TU2.",
      "The note shows the automatic referral is off for this date."
    ]
  },
  {
    "id": "filling",
    "area": "Teeth Chart",
    "title": "A filling replaces an earlier decay",
    "pictures": [
      {
        "file": "filling-chart.png",
        "caption": "Decay recorded Sept 1, filled Sept 26"
      },
      {
        "file": "filling-history.png",
        "caption": "History keeps the decay; the chart shows F"
      }
    ],
    "what": "When a tooth with decay from an earlier date is filled, the chart shows F instead of D. Chart History keeps the decay. If the filled tooth decays again on a later date, both F and D show.",
    "why": "The chart shows the tooth as it is now, and the history is not lost.",
    "how": [
      "Chart D on a tooth for an earlier date.",
      "Change the date, select the same tooth, click F."
    ]
  },
  {
    "id": "mixed",
    "area": "Teeth Chart",
    "title": "Mixed dentition layout, and a permanent tooth growing in",
    "pictures": [
      {
        "file": "mixed-both.png",
        "caption": "Mixed layout; A and J with the permanent tooth growing in behind"
      },
      {
        "file": "mixed-history.png",
        "caption": "Recorded once as “Erupting (primary still present)”"
      }
    ],
    "what": "The Mixed layout has permanent teeth 3, 14, 19, 30 and the four front teeth top and bottom (7–10, 23–26), with baby teeth elsewhere. Selecting a baby tooth and clicking Mixed shows the permanent tooth growing in behind it while the baby tooth is still there.",
    "why": "Matches what staff see in children's mouths.",
    "how": [
      "Teeth Chart → with nothing selected, click Mixed (🦷🦷) for the typical layout.",
      "Select baby tooth A → click Mixed."
    ]
  },
  {
    "id": "undo",
    "area": "Teeth Chart",
    "title": "Undo a wrong dentition click",
    "pictures": [
      {
        "file": "undo-before.png",
        "caption": "Tooth C changed to permanent by mistake"
      },
      {
        "file": "undo-after.png",
        "caption": "↶ Undo puts it back"
      }
    ],
    "what": "↶ Undo reverses the last Primary / Permanent / Mixed click. The teeth and Chart History go back as they were, and nothing extra is recorded.",
    "why": "A wrong click no longer means charting the tooth again or leaving duplicate lines in Chart History.",
    "how": [
      "Select a baby tooth → click Permanent.",
      "Click ↶ Undo."
    ]
  },
  {
    "id": "status-per-date",
    "area": "Teeth Chart",
    "title": "One service status per date",
    "pictures": [
      {
        "file": "status-before.png",
        "caption": "Two entries on September 26, both Initial Visit"
      },
      {
        "file": "status-changed.png",
        "caption": "Service Status changed to Follow up; the note says how many entries change"
      },
      {
        "file": "status-after.png",
        "caption": "Every entry of that date now shows Follow up"
      }
    ],
    "what": "Each date of service has one Service Status. Changing it changes every entry of that date in Chart History (and the appointment) at once. The same happens when the status is changed from a Chart History edit or Edit Appointment. Not Seen and Not Interested are added to Chart History as soon as they are picked (no Save needed); remarks saved afterwards go on that line. If the status is changed back to Initial Visit or Follow up, that line becomes a Remarks line (when it has remarks) or is taken off.",
    "why": "A child has one attendance status per visit, so the entries of one date can no longer disagree.",
    "how": [
      "Open a patient → Teeth Chart, choose a provider.",
      "Chart something on today's date (e.g. D on a tooth).",
      "Change Service Status to Follow up: every entry of that date changes.",
      "On a new date, pick Not Seen - Absent: the line appears in Chart History straight away."
    ]
  }
];
