import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "apps" / "engine"))
import service


class FourSchoolsServiceTest(unittest.TestCase):
    def test_chart_adapter_derives_chart_ir(self):
        chart = service.chart_from({"pillars": "甲子 丙寅 戊辰 庚申", "firstLuck": "辛酉", "luckStartYear": 2020, "startYear": 2025, "endYear": 2026})
        self.assertEqual(chart["day_master"], "戊")
        self.assertEqual(chart["pillars"]["month"]["hidden_stems"][0]["ten_god"], "七杀")
        self.assertEqual(chart["pillars"]["day"]["nayin"]["name"], "大林木")
        self.assertEqual(chart["pillars"]["day"]["twelve_growth_stage"], "冠带")
        self.assertEqual(chart["annual_contexts"][1]["stem"], "丙")
        self.assertEqual(chart["luck_cycles"][1]["stem"] + chart["luck_cycles"][1]["branch"], "壬戌")

    def test_annual_index_is_bounded(self):
        value = service.score([{"stance": "supportive"}, {"stance": "mixed"}, {"stance": "cautionary"}])
        self.assertEqual(value, {"close": 0.0, "high": 1.0, "low": -1.0})

    def test_flow_months_produce_a_real_ohlc_range(self):
        chart = service.chart_from({"pillars": "甲子 丙寅 戊辰 庚申", "firstLuck": "辛酉", "luckStartYear": 2020})
        luck = chart["luck_cycles"][0]
        annual = {"year": 2025, "stem": "乙", "branch": "巳", "stem_ten_god": "正官"}
        candle = service.monthly_candle(chart, luck, annual, annual_anchor=0.0)
        self.assertEqual(service.monthly_pillar(2025, 0), "戊寅")
        self.assertEqual(service.monthly_pillar(2025, 11), "己丑")
        self.assertEqual(len(candle["monthlySamples"]), 12)
        self.assertEqual(candle["open"], candle["monthlySamples"][0]["index"])
        self.assertEqual(candle["close"], candle["monthlySamples"][-1]["index"])
        self.assertGreaterEqual(candle["high"], candle["low"])
        self.assertTrue(all(-100 <= month["index"] <= 100 for month in candle["monthlySamples"]))

    def test_first_run_materializes_eight_luck_cycles(self):
        result = service.run({"pillars": "甲子 丙寅 戊辰 庚申", "firstLuck": "辛酉", "luckStartYear": 2020, "targetYear": 2025})
        self.assertEqual(len(result["chart"]["luckCycles"]), 8)
        trajectory = result["trajectory"]["classical_ziping"]
        self.assertEqual(len(trajectory), 80)
        self.assertEqual(trajectory[0]["year"], 2020)
        self.assertEqual(trajectory[-1]["year"], 2099)
        signatures = {(row["open"], row["high"], row["low"], row["close"]) for row in trajectory}
        self.assertGreater(len(signatures), 40)
        self.assertGreater(sum(row["close"] > row["open"] for row in trajectory), 10)
        self.assertGreater(sum(row["close"] < row["open"] for row in trajectory), 10)


if __name__ == "__main__":
    unittest.main()
