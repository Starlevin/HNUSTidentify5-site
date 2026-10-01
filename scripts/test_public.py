import unittest
from copy import deepcopy
from build import validate_players, profile_html, ROOT

class PublicRosterTests(unittest.TestCase):
    def setUp(self):
        self.player = {"id": "p0001", "nickname": "游戏代号", "role": "survivor",
                       "characters": ["先知", "佣兵"], "rank": ""}

    def test_unrelated_columns_are_rejected(self):
        for key in ("name", "phone", "idCard", "studentId", "wechat", "qq", "private", "raw_row"):
            record = deepcopy(self.player)
            record[key] = "should not be included"
            with self.assertRaises(ValueError):
                validate_players([record])

    def test_numbers_contacts_and_path_traversal_are_rejected(self):
        for key, value in (("rank", "1" * 11), ("intro", "微信：不公开"),
                           ("id", "../../private"), ("nickname", "1" * 8)):
            record = deepcopy(self.player)
            record[key] = value
            with self.assertRaises(ValueError):
                validate_players([record])

    def test_unknown_roles_and_duplicate_ids_are_rejected(self):
        record = deepcopy(self.player)
        record["role"] = "unknown"
        with self.assertRaises(ValueError):
            validate_players([record])
        with self.assertRaises(ValueError):
            validate_players([self.player, self.player])

    def test_new_game_fields_reject_private_information(self):
        for key in ("alias", "survivorPeak", "hunterPeak"):
            record = deepcopy(self.player)
            record[key] = "1" * 11
            with self.assertRaises(ValueError):
                validate_players([record])

    def test_two_historical_ranks_are_kept_separate(self):
        record = {**self.player, "alias": "游戏网名", "survivorPeak": "巅峰七阶31星", "hunterPeak": "七阶14星"}
        clean = validate_players([record])[0]
        self.assertEqual(clean["survivorPeak"], "巅峰七阶31星")
        self.assertEqual(clean["hunterPeak"], "七阶14星")
        page = profile_html((ROOT / "player.html").read_text(encoding="utf-8"), clean)
        self.assertIn("求生者 · 历史最高：巅峰七阶31星", page)
        self.assertIn("监管者 · 历史最高：七阶14星", page)
        self.assertIn('src="../../assets/team-badge.jpg"', page)

    def test_valid_game_profile_and_empty_roster_work(self):
        self.assertEqual(validate_players([]), [])
        result = validate_players([self.player])
        self.assertEqual(result[0]["nickname"], "游戏代号")
        self.assertEqual(result[0]["characters"], ["先知", "佣兵"])
        self.assertEqual(set(result[0]), {"id", "nickname", "role", "characters", "rank", "intro", "alias", "survivorPeak", "hunterPeak"})

    def test_profile_titles_are_escaped_and_assets_use_correct_depth(self):
        record = deepcopy(self.player)
        record["nickname"] = '<game&nickname>'
        template = (ROOT / "player.html").read_text(encoding="utf-8")
        page = profile_html(template, record)
        self.assertIn('data-player-id="p0001"', page)
        self.assertIn("&lt;game&amp;nickname&gt;", page)
        self.assertIn('src="../../app.js?', page)
        self.assertIn('src="../../data/team-roster.js"', page)
        self.assertIn('href="../../roster.html"', page)

if __name__ == "__main__":
    unittest.main()
