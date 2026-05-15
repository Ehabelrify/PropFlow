/**
 * Lead Scoring Algorithm
 * 
 * Calculates a lead score (0-100) based on multiple weighted factors:
 * - Engagement (40%): Activity frequency, recency, and type
 * - Stage Progress (25%): How far along the pipeline
 * - Budget Qualification (20%): Budget vs average property price
 * - Profile Completeness (15%): How much information we have
 * 
 * Higher scores indicate leads more likely to convert.
 */

import type { Lead, Activity } from "./types";

export interface LeadScoringFactors {
  engagement: number;        // 0-40 points
  stageProgress: number;      // 0-25 points
  budgetQualification: number; // 0-20 points
  profileCompleteness: number; // 0-15 points
}

export interface LeadScoringResult {
  score: number;              // Total score 0-100
  factors: LeadScoringFactors;
  recommendations: string[];
}

/**
 * Calculate engagement score based on activities
 * Max: 40 points
 */
function calculateEngagementScore(
  lead: Lead,
  activities: Activity[] = []
): { score: number; recommendations: string[] } {
  const recommendations: string[] = [];
  let score = 0;

  // Activity recency (0-15 points)
  const lastActivityDate = new Date(lead.lastActivityAt);
  const daysSinceActivity = Math.floor(
    (Date.now() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceActivity === 0) {
    score += 15; // Activity today
  } else if (daysSinceActivity <= 1) {
    score += 12; // Activity yesterday
  } else if (daysSinceActivity <= 3) {
    score += 10; // Activity within 3 days
  } else if (daysSinceActivity <= 7) {
    score += 7; // Activity within a week
  } else if (daysSinceActivity <= 14) {
    score += 4; // Activity within 2 weeks
  } else if (daysSinceActivity <= 30) {
    score += 2; // Activity within a month
  } else {
    recommendations.push("No recent activity - reach out soon to re-engage");
  }

  // Activity frequency (0-15 points)
  const activityCount = activities.length;
  if (activityCount >= 10) {
    score += 15; // Highly engaged
  } else if (activityCount >= 7) {
    score += 12;
  } else if (activityCount >= 5) {
    score += 10;
  } else if (activityCount >= 3) {
    score += 7;
  } else if (activityCount >= 1) {
    score += 4;
  } else {
    recommendations.push("Low engagement - schedule a call to build rapport");
  }

  // Activity quality (0-10 points)
  const callCount = activities.filter(a => a.type === "call").length;
  const appointmentCount = activities.filter(a => a.type === "appointment").length;
  
  if (appointmentCount >= 2) {
    score += 10; // Multiple appointments = serious interest
  } else if (appointmentCount >= 1) {
    score += 7;
  } else if (callCount >= 3) {
    score += 5;
  } else if (callCount >= 1) {
    score += 3;
  } else {
    recommendations.push("No calls yet - phone conversation builds trust");
  }

  return { score: Math.min(score, 40), recommendations };
}

/**
 * Calculate stage progress score
 * Max: 25 points
 */
function calculateStageProgressScore(
  lead: Lead
): { score: number; recommendations: string[] } {
  const recommendations: string[] = [];
  
  const stageScores: Record<string, number> = {
    new: 5,          // Just entered pipeline
    contacted: 10,   // Initial contact made
    qualified: 15,   // Qualified as potential buyer
    viewing: 20,     // Viewing properties
    negotiation: 25, // In negotiation phase
    won: 25,         // Deal closed
    lost: 0,         // Lost opportunity
  };

  const score = stageScores[lead.stage] || 0;

  // Add recommendations based on stage
  if (lead.stage === "new") {
    recommendations.push("New lead - make first contact within 24 hours");
  } else if (lead.stage === "contacted") {
    recommendations.push("Qualify budget and requirements to move forward");
  } else if (lead.stage === "qualified") {
    recommendations.push("Schedule property viewing to maintain momentum");
  } else if (lead.stage === "viewing") {
    recommendations.push("Follow up after viewing - gather feedback");
  } else if (lead.stage === "negotiation") {
    recommendations.push("Close to conversion - address objections promptly");
  } else if (lead.stage === "lost") {
    recommendations.push("Lost lead - consider re-engagement campaign later");
  }

  return { score, recommendations };
}

/**
 * Calculate budget qualification score
 * Max: 20 points
 */
function calculateBudgetQualificationScore(
  lead: Lead,
  averagePropertyPrice: number = 500000 // Default average
): { score: number; recommendations: string[] } {
  const recommendations: string[] = [];
  let score = 0;

  if (!lead.budget || lead.budget === 0) {
    recommendations.push("Budget not specified - qualify financial capacity");
    return { score: 0, recommendations };
  }

  // Budget adequacy (0-15 points)
  const budgetRatio = lead.budget / averagePropertyPrice;
  
  if (budgetRatio >= 1.5) {
    score += 15; // Well above average - high purchasing power
  } else if (budgetRatio >= 1.0) {
    score += 12; // At or above average
  } else if (budgetRatio >= 0.75) {
    score += 9; // Slightly below average
  } else if (budgetRatio >= 0.5) {
    score += 6; // Significantly below average
    recommendations.push("Budget below average - show affordable options");
  } else {
    score += 3; // Very low budget
    recommendations.push("Low budget - may need financing options or smaller units");
  }

  // Budget specificity (0-5 points)
  if (lead.budget > 0) {
    score += 5; // Has specific budget in mind
  }

  return { score: Math.min(score, 20), recommendations };
}

/**
 * Calculate profile completeness score
 * Max: 15 points
 */
function calculateProfileCompletenessScore(
  lead: Lead
): { score: number; recommendations: string[] } {
  const recommendations: string[] = [];
  let score = 0;

  // Basic contact info (always present, 3 points)
  if (lead.name && lead.email && lead.phone) {
    score += 3;
  }

  // Requirements specified (6 points)
  if (lead.requirements) {
    if (lead.requirements.bedrooms) score += 1.5;
    if (lead.requirements.bathrooms) score += 1.5;
    if (lead.requirements.area) score += 1.5;
    if (lead.requirements.location) score += 1.5;
  } else {
    recommendations.push("Requirements not captured - ask about preferences");
  }

  // Property interest (3 points)
  if (lead.propertyInterest) {
    score += 3;
  } else {
    recommendations.push("No specific property interest - show portfolio");
  }

  // Notes/additional info (3 points)
  if (lead.notes && lead.notes.length > 20) {
    score += 3;
  } else {
    recommendations.push("Limited notes - document conversations for context");
  }

  return { score: Math.min(score, 15), recommendations };
}

/**
 * Main lead scoring function
 * Calculates comprehensive score with breakdown and recommendations
 */
export function calculateLeadScore(
  lead: Lead,
  activities: Activity[] = [],
  averagePropertyPrice?: number
): LeadScoringResult {
  // Calculate individual factor scores
  const engagement = calculateEngagementScore(lead, activities);
  const stageProgress = calculateStageProgressScore(lead);
  const budgetQualification = calculateBudgetQualificationScore(
    lead,
    averagePropertyPrice
  );
  const profileCompleteness = calculateProfileCompletenessScore(lead);

  // Combine scores
  const totalScore = Math.round(
    engagement.score +
    stageProgress.score +
    budgetQualification.score +
    profileCompleteness.score
  );

  // Combine recommendations
  const allRecommendations = [
    ...engagement.recommendations,
    ...stageProgress.recommendations,
    ...budgetQualification.recommendations,
    ...profileCompleteness.recommendations,
  ];

  return {
    score: Math.min(Math.max(totalScore, 0), 100), // Clamp to 0-100
    factors: {
      engagement: engagement.score,
      stageProgress: stageProgress.score,
      budgetQualification: budgetQualification.score,
      profileCompleteness: profileCompleteness.score,
    },
    recommendations: allRecommendations,
  };
}

/**
 * Determine if a lead should be marked as "hot"
 * Hot leads are high-priority and need immediate attention
 */
export function isHotLead(scoringResult: LeadScoringResult, lead: Lead): boolean {
  // High score (75+) = hot
  if (scoringResult.score >= 75) return true;

  // In negotiation stage = hot
  if (lead.stage === "negotiation") return true;

  // Recent high engagement = hot
  const daysSinceActivity = Math.floor(
    (Date.now() - new Date(lead.lastActivityAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (scoringResult.factors.engagement >= 30 && daysSinceActivity <= 1) {
    return true;
  }

  return false;
}

/**
 * Get score category label
 */
export function getScoreCategory(score: number): {
  label: string;
  color: string;
  description: string;
} {
  if (score >= 75) {
    return {
      label: "Hot",
      color: "text-hot",
      description: "High conversion probability - prioritize immediately",
    };
  } else if (score >= 50) {
    return {
      label: "Warm",
      color: "text-warning",
      description: "Good potential - maintain regular contact",
    };
  } else if (score >= 25) {
    return {
      label: "Cool",
      color: "text-muted-foreground",
      description: "Needs nurturing - build relationship over time",
    };
  } else {
    return {
      label: "Cold",
      color: "text-muted-foreground/60",
      description: "Low engagement - consider re-qualification",
    };
  }
}

// Made with Bob
