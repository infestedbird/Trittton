import unittest
from unittest.mock import patch

import tss


class TssAdapterTests(unittest.TestCase):
    def test_tss_transition_boundary(self):
        self.assertFalse(tss.is_tss_term("SA26"))
        self.assertTrue(tss.is_tss_term("FA26"))
        self.assertTrue(tss.is_tss_term("WI27"))
        self.assertFalse(tss.is_tss_term("bogus"))

    def test_normalizes_course_section_and_meeting_days(self):
        course = tss.normalize_course({
            "subject_code": "CSE",
            "course_code": "008A",
            "module_name": "Intro to Programming 1",
            "units_display": "4 units",
            "open_seat_count": 9,
            "waitlist_available_count": 0,
            "sections": [{
                "section_id": "E 00002703",
                "section_code": "001-001-LA",
                "instruction_type_name": "lab",
                "capacity": 15,
                "seats_available": 9,
                "waitlist_enrolled": 0,
                "waitlist_available": None,
                "instructors": ["Leo Porter"],
                "meetings": [
                    {
                        "meeting_kind": "class",
                        "day_code": "T",
                        "start_minutes": 660,
                        "end_minutes": 710,
                        "start_time_display": "11:00am",
                        "end_time_display": "11:50am",
                        "building_code": "EBU3B",
                        "room_code": "EBU3B B260",
                    },
                    {
                        "meeting_kind": "class",
                        "day_code": "R",
                        "start_minutes": 660,
                        "end_minutes": 710,
                        "start_time_display": "11:00am",
                        "end_time_display": "11:50am",
                        "building_code": "EBU3B",
                        "room_code": "EBU3B B260",
                    },
                ],
            }],
        })

        self.assertEqual(course["course_code"], "CSE 8A")
        self.assertEqual(course["units"], "4")
        self.assertEqual(course["open_seat_count"], 9)
        section = course["sections"][0]
        self.assertEqual(section["type"], "LA")
        self.assertEqual(section["days"], "TuTh")
        self.assertEqual(section["time"], "11:00a-11:50a")
        self.assertEqual(section["building"], "EBU3B")
        self.assertEqual(section["room"], "B260")

    def test_waitlist_only_section_never_reports_open_seats(self):
        course = tss.normalize_course({
            "subject_code": "ECE",
            "course_code": "035",
            "module_name": "Introduction to Analog Design",
            "units_display": "4 units",
            "open_seat_count": 0,
            "waitlist_available_count": 0,
            "sections": [{
                "section_id": "E 00005147",
                "section_code": "001-001-LA",
                "instruction_type_name": "lab",
                "capacity": 30,
                "seats_available": 30,
                "waitlist_enrolled": 0,
                "waitlist_available": None,
                "status": "waitlist_only",
                "instructors": ["Curt Schurgers"],
                "meetings": [],
            }],
        })

        section = course["sections"][0]
        self.assertEqual(section["available"], "0")
        self.assertEqual(section["limit"], "30")
        self.assertEqual(section["status"], "waitlist_only")

    def test_zero_open_course_clamps_active_section_seats(self):
        course = tss.normalize_course({
            "subject_code": "AAS",
            "course_code": "170",
            "module_name": "Legacies of Research",
            "units_display": "4 units",
            "open_seat_count": 0,
            "waitlist_available_count": 0,
            "sections": [{
                "section_id": "E 00000039",
                "section_code": "001-000-SE",
                "instruction_type_name": "seminar",
                "capacity": 40,
                "seats_available": 31,
                "waitlist_enrolled": 0,
                "waitlist_available": None,
                "status": "AC",
                "instructors": ["Chadwick Campbell"],
                "meetings": [],
            }],
        })

        self.assertEqual(course["open_seat_count"], 0)
        self.assertEqual(course["sections"][0]["available"], "0")
        self.assertEqual(course["sections"][0]["limit"], "40")

    @patch("tss._request_json")
    def test_booking_handoff_returns_official_course_link(self, request_json):
        request_json.side_effect = [
            {"schedule_ref": "encoded"},
            {
                "valid": True,
                "course_details": {
                    "cse-008a": {
                        "subject_code": "CSE",
                        "course_code": "008A",
                        "course_title": "Intro to Programming 1",
                        "module_id": "8461",
                        "event_package_id": "154302",
                        "tss_booking_url": "https://tss.ucsd.edu/fiori#course-link",
                        "sections": [{
                            "section_id": "E 00000958",
                            "section_code": "001-000-LE",
                            "instruction_type": "lecture",
                            "seats": "102/135",
                            "waitlist": "0",
                        }],
                    },
                },
            },
        ]

        result = tss.create_booking_handoff("FA26", ["E 00000958"])
        self.assertTrue(result["valid"])
        self.assertEqual(result["planner_url"], "https://classplanner.apps.ucsd.edu/view/encoded?mode=planner")
        self.assertEqual(result["courses"][0]["course_code"], "CSE 8A")
        self.assertEqual(result["courses"][0]["tss_booking_url"], "https://tss.ucsd.edu/fiori#course-link")


if __name__ == "__main__":
    unittest.main()
