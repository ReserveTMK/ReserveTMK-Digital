import { pool } from "../server/db";
import { storage } from "../server/storage";

async function seedOrgProfile() {
  const userId = "54568936";

  const defaults = {
    mission: "ReserveTMK Digital is a Māori-centred innovation and coworking hub in Glen Innes, serving the people of the Tāmaki rohe. We exist as infrastructure for Māori and Pacific economic and community self-determination — not a programme delivered to people, but a place people use to build their own futures.",
    description: "We are part of the GridAKL innovation network — the eastern anchor serving Māori and Pacific peoples' led startups and enterprises in East Auckland. We hold recognised investment from the Auckland Council Māori Outcomes Fund and operate as named infrastructure within Auckland's economic development ecosystem. We serve Māori entrepreneurs, community enterprises, rangatahi and emerging founders, Pacific peoples' led startups, and mana whenua and mātaawaka with whakapapa and community ties to this rohe.",
    focusAreas: ["Māori entrepreneurs", "community enterprises", "rangatahi and emerging founders", "Pacific peoples' led startups", "mana whenua and mātaawaka", "coworking", "innovation"],
    values: "Tino Rangatiratanga — Māori self-determination is at the centre of everything we do. Whanaungatanga — Connection is the core product. Manaakitanga — How people are welcomed matters as much as what they do here. Kaitiakitanga — We hold this space in trust for the community. Ōhanga Māori — Māori economic participation built from the inside out through local enterprise, local networks and local infrastructure. Kotahitanga — We are stronger as a network, acting with one shared purpose across GridAKL, MOF hubs, local boards and partner organisations.",
    location: "Glen Innes, Tāmaki Makaurau",
    targetCommunity: "Māori and Pacific peoples in the Tāmaki rohe — entrepreneurs, community enterprises, rangatahi, mana whenua and mātaawaka",
  };

  try {
    console.log("Seeding organisation profile for userId:", userId);

    const profile = await storage.upsertOrganisationProfile(userId, defaults);

    console.log("✓ Profile seeded successfully! id:", profile.id);
    console.log("  mission:", profile.mission?.substring(0, 60) + "...");
    console.log("  location:", profile.location);
    console.log("  focusAreas:", profile.focusAreas);
  } catch (error) {
    console.error("Error seeding organisation profile:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

seedOrgProfile();
