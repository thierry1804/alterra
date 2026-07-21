export interface TeamChef {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  teamId?: string | null;
}

export interface TeamMember {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
  teamId: string | null;
}

export interface TeamSummary {
  id: string;
  siteId: string;
  name: string;
  chefId: string | null;
  active: boolean;
  createdAt: string;
  chef: TeamChef | null;
  memberCount: number;
}

export interface TeamDetail extends TeamSummary {
  members: TeamMember[];
}

export interface WorkerSearchHit {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
  teamId: string | null;
}
