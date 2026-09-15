export interface CreateLeadRequest {
  configurationPublicId: string;
  name: string;
  email: string;
  phone: string | null;
  preferredContact: "EMAIL" | "PHONE";
  message: string | null;
  requestType: "QUOTE" | "TEST_DRIVE";
}

export interface LeadDto {
  id: string;
  configurationPublicId: string;
  vehicleSlug: string;
  name: string;
  email: string;
  phone: string | null;
  preferredContact: "EMAIL" | "PHONE";
  message: string | null;
  requestType: "QUOTE" | "TEST_DRIVE";
  status: "NEW" | "CONTACTED" | "CLOSED";
  createdAt: string;
}
