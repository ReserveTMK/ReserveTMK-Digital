import { pool, db } from "../server/db";
import { funders } from "@shared/schema";
import { eq } from "drizzle-orm";

async function insertFunder() {
  try {
    const funderData = {
      userId: "54568936",
      name: "Ngā Mātārae – Māori Outcomes Fund",
      organisation: "Auckland Council – Māori Outcomes Directorate",
      status: "active",
      communityLens: "maori",
      outcomesFramework: "Tāmaki Ora 2025–2027",
      outcomeFocus: `Whai Rawa Ora (Economic Wellbeing): Māori businesses and entrepreneurs grow wealth. Indicators: number of Māori entrepreneurs/enterprises using hub, repeat usage rate, revenue from hub activity, enterprises that grew/sustained, jobs/income created.

Te Hapori Ora (Community Wellbeing): Whānau and communities connected and thriving. Indicators: activations/events/hui hosted, total community attendees, organisations partnered with, community connections formed, proportion of Māori users.

Tuakiri Ora (Cultural Identity): Tāmaki reflects te reo Māori, tikanga and Māori identity. Indicators: te reo visible in operations, kaupapa Māori programming, Māori-led events, user feedback on cultural safety.

Huatau Ora (Future Wellbeing): Māori empowered to lead innovation and build intergenerational systems. Indicators: youth/rangatahi support, innovation kaupapa hosted, emerging entrepreneur capability building.`,
      reportingGuidance: `Reporting Rhythm:
• Monthly: Usage numbers, events, activations, venue hire → Internal / Tātaki Auckland Unlimited
• Quarterly: Progress against Tāmaki Ora indicators, partnership updates, stories of impact → Ngā Mātārae / MOF reporting
• Annually: Full outcomes report — quantitative and qualitative, co-investment summary, forward plan → Auckland Council Māori Outcomes Report cycle

What they want to see: Co-investment leverage from other funders (DIA, TPK, MBIE, local board), qualitative impact stories, demographic capture (proportion Māori), partnership updates.

Framing: Infrastructure for Māori self-determination — not a service delivered to people, but a place that enables people to do their own mahi. One of three hubs (alongside Te Ngāhere Henderson, Grid MNK Manukau) demonstrating regional MOF reach.`,
      reportingCadence: "quarterly",
      narrativeStyle: "partnership",
      funderTag: "nga-matarae",
      contractStart: new Date("2025-01-01T00:00:00.000Z"),
      contractEnd: new Date("2027-12-31T00:00:00.000Z"),
    };

    console.log("Inserting funder record...");
    const [inserted] = await db
      .insert(funders)
      .values(funderData)
      .returning();

    console.log("✓ Funder inserted successfully!");
    console.log("Funder ID:", inserted.id);
    console.log("Funder name:", inserted.name);
    console.log("Funder tag:", inserted.funderTag);

    // Verify by querying
    console.log("\nVerifying funder record in database...");
    const [verified] = await db
      .select()
      .from(funders)
      .where(eq(funders.funderTag, "nga-matarae"));

    if (verified) {
      console.log("✓ Verification successful!");
      console.log("Retrieved funder:", {
        id: verified.id,
        name: verified.name,
        organisation: verified.organisation,
        status: verified.status,
        communityLens: verified.communityLens,
        funderTag: verified.funderTag,
        contractStart: verified.contractStart,
        contractEnd: verified.contractEnd,
      });
    } else {
      console.log("✗ Funder not found in verification query");
    }
  } catch (error) {
    console.error("Error inserting funder:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

insertFunder();
