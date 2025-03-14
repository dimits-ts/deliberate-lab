import { 
    BaseSurveyAnswer,
    BaseSurveyQuestion, 
    CheckSurveyQuestion, 
    MultipleChoiceSurveyQuestion, 
    ScaleSurveyQuestion, 
    SurveyQuestionKind, 
    TextSurveyQuestion } from "./survey_stage";

/**
 * Determines the appropriate prompt format for a given survey question.
 * @param {BaseSurveyQuestion} question - A survey question object.
 * @returns {string} - The formatted question prompt.
 */
export function createSurveyQuestionPrompt(question: BaseSurveyQuestion): string {
    switch (question.kind) {
        case SurveyQuestionKind.TEXT:
            return _createTextQuestionPrompt(question as TextSurveyQuestion);
        case SurveyQuestionKind.CHECK:
            return _createCheckQuestionPrompt(question as CheckSurveyQuestion);
        case SurveyQuestionKind.MULTIPLE_CHOICE:
            return _createMultipleChoiceQuestionPrompt(question as MultipleChoiceSurveyQuestion);
        case SurveyQuestionKind.SCALE:
            return _createScaleQuestionPrompt(question as ScaleSurveyQuestion);
        default:
            console.error(`Unknown survey question type: ${question.kind}`);
            return "";
    }
}

function _createTextQuestionPrompt(question: TextSurveyQuestion): string {
    return `Answer the following question freely: "${question.questionTitle}"`;
}

function _createCheckQuestionPrompt(question: CheckSurveyQuestion): string {
    return `Answer the following question with only "yes" or "no": "${question.questionTitle}"`;
}

function _createMultipleChoiceQuestionPrompt(question: MultipleChoiceSurveyQuestion): string {
    let prompt = `Multiple Choice Question: ${question.questionTitle}\n Options: \n`;
    for (let i in question.options) {
        const option = question.options[i].text
        prompt += `${i}. ${option}\n`;
    }
    prompt += "Select one of the options above. Answer with a single number only."

    return prompt;
}

function _createScaleQuestionPrompt(question: ScaleSurveyQuestion): string {
    return `From a scale of ${question.lowerValue} (${question.lowerText}) to ${question.upperValue} (${question.upperText})
    rate the following question: "${question.questionTitle}"?
    Answer with a single number only.`;
}