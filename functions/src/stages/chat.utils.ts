import {
  AgentChatResponse,
  ChatMessage,
  ChatStageConfig,
  ChatStagePublicData,
  ExperimenterData,
  ParticipantProfile,
  ParticipantStatus,
  getDefaultChatPrompt,
  getTimeElapsed,
} from '@deliberation-lab/utils';

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import {Timestamp} from 'firebase-admin/firestore';
import {onCall} from 'firebase-functions/v2/https';

import {app} from '../app';
import {getAgentResponse} from '../agent.utils';

/** Get the chat stage configuration based on the event. */
export async function getChatStage(
  experimentId: string,
  stageId: string,
): Promise<ChatStageConfig | null> {
  const stageRef = app
    .firestore()
    .doc(`experiments/${experimentId}/stages/${stageId}`);

  const stageDoc = await stageRef.get();
  if (!stageDoc.exists) return null; // Return null if the stage doesn't exist.

  return stageDoc.data() as ChatStageConfig; // Return the stage data.
}

/** Get public data for the given chat stage. */
export async function getChatStagePublicData(
  experimentId: string,
  cohortId: string,
  stageId: string,
): Promise<ChatStagePublicData | null> {
  const publicStageRef = app
    .firestore()
    .doc(
      `experiments/${experimentId}/cohorts/${cohortId}/publicStageData/${stageId}`,
    );

  const publicStageDoc = await publicStageRef.get();
  if (!publicStageDoc.exists) return null; // Return null if the public stage data doesn't exist.

  return publicStageDoc.data() as ChatStagePublicData; // Return the public stage data.
}

/** Get chat messages for given cohort and stage ID. */
export async function getChatMessages(
  experimentId: string,
  cohortId: string,
  stageId: string,
): Promise<ChatMessage[]> {
  try {
    return (
      await app
        .firestore()
        .collection(
          `experiments/${experimentId}/cohorts/${cohortId}/publicStageData/${stageId}/chats`,
        )
        .orderBy('timestamp', 'asc')
        .get()
    ).docs.map((doc) => doc.data() as ChatMessage);
  } catch (error) {
    console.log(error);
    return [];
  }
}

/** Get number of chat messages for given cohort and stage ID. */
export async function getChatMessageCount(
  experimentId: string,
  cohortId: string,
  stageId: string,
): Promise<number> {
  try {
    return (
      await app
        .firestore()
        .collection(
          `experiments/${experimentId}/cohorts/${cohortId}/publicStageData/${stageId}/chats`,
        )
        .count()
        .get()
    ).data().count;
  } catch (error) {
    console.log(error);
    return 0;
  }
}

/**
 * If all active participants in cohort are ready to end current discussion,
 * set currentDiscussionId to ID of next discussion in chat config list.
 */
export async function updateCurrentDiscussionIndex(
  experimentId: string,
  cohortId: string,
  stageId: string,
  publicStageData: ChatStagePublicData,
) {
  // Get active participants for given cohort
  // TODO: Create shared utils under /utils for isActiveParticipant
  const activeStatuses = [
    ParticipantStatus.IN_PROGRESS,
    ParticipantStatus.COMPLETED,
    ParticipantStatus.ATTENTION_CHECK,
  ];
  const activeParticipants = (
    await app
      .firestore()
      .collection('experiments')
      .doc(experimentId)
      .collection('participants')
      .where('currentCohortId', '==', cohortId)
      .get()
  ).docs
    .map((doc) => doc.data() as ParticipantProfile)
    .filter((participant) =>
      activeStatuses.find((status) => status === participant.currentStatus),
    );

  // Check if active participants are ready to end current discussion
  const currentDiscussionId = publicStageData.currentDiscussionId;
  const isReadyToEndDiscussion = () => {
    const timestampMap = publicStageData.discussionTimestampMap;

    for (const participant of activeParticipants) {
      if (!timestampMap[currentDiscussionId][participant.publicId]) {
        return false;
      }
    }
    return true;
  };

  if (!isReadyToEndDiscussion()) {
    return;
  }

  // If ready, get next discussion ID from stage config
  // and update currentDiscussionId accordingly
  const stage = (
    await app
      .firestore()
      .collection('experiments')
      .doc(experimentId)
      .collection('stages')
      .doc(stageId)
      .get()
  ).data() as ChatStageConfig;
  const currentIndex = stage.discussions.findIndex(
    (item) => item.id === currentDiscussionId,
  );
  if (currentIndex === stage.discussions.length - 1) {
    // If invalid or last discussion completed, set null
    publicStageData.currentDiscussionId = null;
  } else {
    publicStageData.currentDiscussionId =
      stage.discussions[currentIndex + 1].id;
  }

  return publicStageData;
}

/** Checks whether the chat has ended, returning true if ending chat. */
export async function hasEndedChat(
  experimentId: string,
  cohortId: string,
  stageId: string,
  chatStage: ChatStageConfig | null,
  publicStageData: ChatStagePublicData | null,
): Promise<boolean> {
  if (!chatStage || !publicStageData || !chatStage.timeLimitInMinutes)
    return false;

  const elapsedMinutes = getTimeElapsed(
    publicStageData.discussionStartTimestamp!,
    'm',
  );

  // Check if the elapsed time has reached or exceeded the time limit
  if (elapsedMinutes >= chatStage.timeLimitInMinutes) {
    await app
      .firestore()
      .doc(
        `experiments/${experimentId}/cohorts/${cohortId}/publicStageData/${stageId}`,
      )
      .update({discussionEndTimestamp: Timestamp.now()});
    return true; // Indicate that the chat has ended.
  }
  return false;
}

/** Queries LLM API and parses chat response for given agent. */
export async function getAgentChatResponse(
  agent: AgentConfig,
  stage: ChatStageConfig,
  chatMessages: ChatMessage[],
  experimenterData: ExperimenterData,
): AgentChatResponse | null {
  // TODO: Return null if agent's number of chat messages exceeds maxResponses
  // TODO: Return null if minMessageBeforeResponding not met
  // TODO: Return null if canSelfTriggerCalls is false and latest message
  //       is from the same agent

  try {
    const prompt = getDefaultChatPrompt(agent, stage, chatMessages);

    // Call LLM API with given modelCall info
    // TODO: Incorporate number of retries
    const response = await getAgentResponse(experimenterData, prompt, agent);

    // Add agent message if non-empty
    let message = response.text;
    let parsed = '';

    if (agent.responseConfig.isJSON) {
      // Reset message to empty before trying to fill with JSON response
      message = '';

      try {
        const cleanedText = response.text
          .replace(/```json\s*|\s*```/g, '')
          .trim();
        parsed = JSON.parse(cleanedText);
      } catch {
        // Response is already logged in console during Gemini API call
        console.log('Could not parse JSON!');
        return null;
      }
      message = parsed[agent.responseConfig.messageField] ?? '';
      if (message.trim().length === 0) {
        return null;
      }
    }

    return {agent, parsed, message};
  } catch (error) {
    console.log(error); // TODO: Write log to backend
    return null;
  }
}

/** Selects agent response from set of relevant agents' responses
 *  (or null if none)
 */
export async function selectSingleAgentChatResponse(
  stage: ChatStageConfig,
  chatMessages: ChatMessage[],
  experimenterData: ExperimenterData,
): AgentChatResponse | null {
  // Generate responses for all agents
  const agentResponses: AgentChatResponse[] = [];
  for (const agent of stage.agents) {
    const response = await getAgentChatResponse(
      agent,
      stage,
      chatMessages,
      experimenterData,
    );
    if (response) {
      agentResponses.push(response);
    }
  }

  // If no responses, return
  if (agentResponses.length === 0) {
    console.log('No agents wish to speak');
    return null;
  }

  // TODO: Write logs to Firestore
  console.log('The following participants wish to speak:');
  agentResponses.forEach((response) => {
    console.log(
      `\t${response.agent.name}: ${response.message} (WPM: ${response.agent.wordsPerMinute})`,
    );
  });

  // Weighted sampling based on wordsPerMinute (WPM)
  // TODO (#426): Refactor WPM logic into separate utils function
  const totalWPM = agentResponses.reduce(
    (sum, response) => sum + (response.agent.wordsPerMinute || 0),
    0,
  );
  const cumulativeWeights: number[] = [];
  let cumulativeSum = 0;
  for (const response of agentResponses) {
    cumulativeSum += response.agent.wordsPerMinute || 0;
    cumulativeWeights.push(cumulativeSum / totalWPM);
  }
  const random = Math.random();
  const chosenIndex = cumulativeWeights.findIndex((weight) => random <= weight);

  // TODO: Write log to Firestore
  console.log(
    `${agentResponses[chosenIndex].agent.name} has been chosen out of ${agentResponses.length} agents with responses.`,
  );
  return agentResponses[chosenIndex] ?? null;
}
