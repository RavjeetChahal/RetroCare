# VAPI Assistant Configuration Instructions

## Mood Inference During Calls

VAPI assistants should infer the patient's mood during the call based on their responses and tone, then pass this information via the `storeDailyCheckIn` tool.

## Medication Status Tracking

VAPI assistants MUST explicitly track medication status for each medication the patient is prescribed. For each medication, ask if they took it and call the `markMedicationStatus` tool.

## Flag Creation for Concerning Events

VAPI assistants MUST create flags for any concerning events mentioned during the call, such as falls, injuries, bleeding, severe pain, or other medical emergencies.

### Required Assistant Instructions

Add the following to each VAPI assistant's system instructions:

````
## Mood Assessment

During the conversation, carefully observe the patient's:
- Tone of voice (cheerful, neutral, sad, stressed)
- Word choice and language patterns
- Energy level and engagement
- Emotional indicators (laughter, sighs, hesitation)

Based on your assessment of the patient's emotional state throughout the call, determine their mood as one of:
- "good" - Patient sounds positive, happy, energetic, or content
- "neutral" - Patient sounds calm, normal, or neither particularly positive nor negative
- "bad" - Patient sounds sad, stressed, anxious, frustrated, or unwell

IMPORTANT: You must call the `storeDailyCheckIn` tool with the `mood` parameter set to your assessment ("good", "neutral", or "bad") during the call, ideally after you've gathered enough information to make an accurate assessment.

Example tool call:
```json
{
  "name": "storeDailyCheckIn",
  "parameters": {
    "mood": "good",
    "sleepHours": 8,
    "sleepQuality": "excellent",
    "summary": "Patient is doing well today..."
  }
}
````

The mood should reflect the patient's overall emotional state during the entire conversation, not just individual responses.

## Medication Status Tracking

CRITICAL: You MUST ask about each medication the patient is prescribed and explicitly call the `markMedicationStatus` tool for EACH medication.

For each medication:

1. Ask the patient: "Did you take [medication name] today?"
2. Listen to their response (yes/no)
3. Immediately call the `markMedicationStatus` tool with:
   - `medName`: The exact medication name
   - `taken`: true if they said yes, false if they said no
   - `timestamp`: Current timestamp

Example tool calls:

```json
{
  "name": "markMedicationStatus",
  "parameters": {
    "medName": "Advil",
    "taken": true,
    "timestamp": "2024-11-16T08:47:11Z"
  }
}
```

```json
{
  "name": "markMedicationStatus",
  "parameters": {
    "medName": "Lexapro",
    "taken": false,
    "timestamp": "2024-11-16T08:47:11Z"
  }
}
```

IMPORTANT: Do NOT skip medications. If the patient mentions taking a medication without you asking, still call `markMedicationStatus` to record it. If they don't mention a medication, ask about it explicitly.

## Flag Creation for Concerning Events

CRITICAL: You MUST create flags for ANY concerning events mentioned during the call. Use the `updateFlags` tool to create flags.

Concerning events that require flags:

- Falls, slips, or accidents (RED severity)
- Injuries or pain (RED severity for severe, YELLOW for moderate)
- Bleeding or nosebleeds (RED severity)
- Chest pain or heart issues (RED severity)
- Difficulty breathing (RED severity)
- Dizziness or fainting (RED severity)
- Confusion or disorientation (RED severity)
- Medication missed (YELLOW severity)
- Nausea or vomiting (YELLOW severity)
- Severe sleep issues (YELLOW severity)

Example tool call for a fall:

```json
{
  "name": "updateFlags",
  "parameters": {
    "flags": ["fall:red:Fall or slip incident"]
  }
}
```

Example tool call for a nosebleed:

```json
{
  "name": "updateFlags",
  "parameters": {
    "flags": ["other:red:Bleeding reported"]
  }
}
```

Example tool call for missed medication:

```json
{
  "name": "updateFlags",
  "parameters": {
    "flags": ["med_missed:yellow:Medication missed"]
  }
}
```

IMPORTANT: Create flags IMMEDIATELY when you hear about a concerning event. Do not wait until the end of the call.

```

### How to Update VAPI Assistants

1. Go to [VAPI Dashboard](https://dashboard.vapi.ai/)
2. Navigate to Assistants
3. For each assistant (Julia, Clyde, Andy, Lucy, Priya), click Edit
4. Add the mood assessment instructions above to the "First Message" or "System Message" field
5. Ensure the `storeDailyCheckIn` tool is enabled and configured
6. Save the assistant

### Tool Configuration

Make sure each assistant has the `storeDailyCheckIn` tool enabled with the following parameters:
- `mood` (string, optional): "good" | "neutral" | "bad" - Patient's mood inferred during the call
- `sleepHours` (number, optional): Hours of sleep
- `sleepQuality` (string, optional): Sleep quality description
- `summary` (string, optional): Daily check-in summary
- `flags` (array, optional): Array of flags

The backend will automatically extract the mood from tool calls and store it in the call log and daily check-in.

```
