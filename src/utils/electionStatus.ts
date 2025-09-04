import { isPast } from "date-fns";

export interface ElectionStatus {
  isActive: boolean;
  statusLabel: string;
  statusType: 'active' | 'expired' | 'closed_early';
}

export const getElectionStatus = (election: {
  end_date: string;
  closed_manually_at?: string | null;
  status?: string;
}): ElectionStatus => {
  const endDate = new Date(election.end_date);
  const isNaturallyExpired = isPast(endDate);
  const isManuallyClosed = election.closed_manually_at != null;
  const hasClosedStatus = election.status === 'closed_manually';

  // Election is closed if it was manually closed OR naturally expired
  const isClosed = isManuallyClosed || hasClosedStatus || isNaturallyExpired;
  
  if (isManuallyClosed || hasClosedStatus) {
    return {
      isActive: false,
      statusLabel: 'Closed Early',
      statusType: 'closed_early'
    };
  }
  
  if (isNaturallyExpired) {
    return {
      isActive: false,
      statusLabel: 'Completed',
      statusType: 'expired'
    };
  }
  
  return {
    isActive: true,
    statusLabel: 'Active',
    statusType: 'active'
  };
};