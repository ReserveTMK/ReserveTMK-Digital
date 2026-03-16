import { pool, db } from "../server/db";
import { funders } from "@shared/schema";
import { eq, and } from "drizzle-orm";

async function upsertFoundationNorth() {
  try {
    const userId = "54568936";
    const funderTag = "foundation-north";

    const funderData = {
      userId,
      name: "Foundation North — Pūtea Hāpai Oranga",
      organisation: "Foundation North",
      status: "active_funder",
      communityLens: "maori",
      outcomesFramework: "Increased Equity / Community Support",
      outcomeFocus: `Increased Equity (Hāpai te ōritetanga): Improved equity and wellbeing outcomes for Māori — communities leading their own solutions, not having solutions delivered to them. Indicators: Māori entrepreneurs/enterprises supported, whānau reporting improved confidence or capability, community-led initiatives launched, equitable access to enterprise support, cultural safety ratings.

Community Support (Hāpori awhina): Connected, resilient communities with access to spaces, networks, and opportunities. Indicators: community events/hui hosted, total attendees (proportion Māori), community connections and networks formed, organisations partnered with, user satisfaction and sense of belonging, pride and resilience indicators.

Te Tiriti o Waitangi (cross-cutting): Te reo Māori visible and normalised, kaupapa Māori embedded in operations, Māori-led decision making. Indicators: te reo visible in signage/communications/programmes, kaupapa Māori programming delivered, Māori governance and advisory involvement, tikanga integration in operations, Māori staff and facilitator representation.`,
      reportingGuidance: `Grant Types:
• Quick Response Grant: Up to $25,000, approximately 2-month decision turnaround
• Community Grant: Over $25,000, approximately 5-month decision turnaround

Reporting: 12-month impact report required at end of funding period.

Application Strategy:
• Lead with community voice — stories of whānau and communities leading change
• Show tangata whenua priority alignment — how the mahi centres Māori needs and aspirations
• Demonstrate community-led solutions, not service delivery
• Evidence of Te Tiriti commitment in governance and operations
• Include both quantitative indicators and qualitative impact stories

What to show: Community ownership and self-determination, grassroots impact stories, te reo and tikanga integration, equitable access, partnership and collaboration evidence.

What to avoid: Deficit framing, top-down service delivery language, purely statistical reporting without community voice, treating Māori as beneficiaries rather than leaders.`,
      reportingCadence: "annual",
      narrativeStyle: "story",
      funderTag,
      prioritySections: ["engagement", "outcomes", "impact"],
      isDefault: true,
    };

    const existing = await db
      .select()
      .from(funders)
      .where(and(eq(funders.userId, userId), eq(funders.funderTag, funderTag)));

    if (existing.length > 0) {
      console.log(`Found existing Foundation North record (id: ${existing[0].id}). Updating...`);
      const { userId: _uid, ...updateData } = funderData;
      const [updated] = await db
        .update(funders)
        .set(updateData)
        .where(eq(funders.id, existing[0].id))
        .returning();

      console.log("✓ Foundation North updated successfully!");
      console.log("Funder ID:", updated.id);
      console.log("Funder name:", updated.name);
    } else {
      console.log("No existing Foundation North record found. Inserting...");
      const [inserted] = await db
        .insert(funders)
        .values(funderData)
        .returning();

      console.log("✓ Foundation North inserted successfully!");
      console.log("Funder ID:", inserted.id);
      console.log("Funder name:", inserted.name);
    }

    const [verified] = await db
      .select()
      .from(funders)
      .where(and(eq(funders.userId, userId), eq(funders.funderTag, funderTag)));

    if (verified) {
      console.log("\n✓ Verification successful!");
      console.log("Retrieved funder:", {
        id: verified.id,
        name: verified.name,
        organisation: verified.organisation,
        communityLens: verified.communityLens,
        outcomesFramework: verified.outcomesFramework,
        reportingCadence: verified.reportingCadence,
        narrativeStyle: verified.narrativeStyle,
        funderTag: verified.funderTag,
      });
    } else {
      console.log("✗ Funder not found in verification query");
    }
  } catch (error) {
    console.error("Error upserting Foundation North funder:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

upsertFoundationNorth();
