"""Small Gemini-backed DeepEval example used by start.cmd."""

from deepeval import assert_test
from deepeval.metrics import GEval
from deepeval.test_case import LLMTestCase, SingleTurnParams


def test_gemini_evaluation():
    test_case = LLMTestCase(
       input="The user's question",
        actual_output="The answer produced by your AI",
        expected_output="The ideal answer",
    )

    correctness = GEval(
        name="Correctness",
        criteria=(
            "Determine whether the actual output correctly matches the "
            "expected output."
        ),
        evaluation_params=[
            SingleTurnParams.ACTUAL_OUTPUT,
            SingleTurnParams.EXPECTED_OUTPUT,
        ],
        threshold=0.5,
    )

    assert_test(test_case, [correctness])
