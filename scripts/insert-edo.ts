import { pool, db } from "../server/db";
import { funders } from "@shared/schema";
import { eq, and } from "drizzle-orm";

async function upsertEdo() {
  try {
    const userId = "54568936";
    const funderTag = "edo-auckland-council";

    const funderData = {
      userId,
      name: "EDO / Auckland Council — Economic Development Office",
      organisation: "Auckland Council Economic Development Office",
      status: "active_funder",
      communityLens: "all",
      outcomesFramework: "Inclusive & Sustainable Economic Growth",
      outcomeFocus: `Inclusive Economic Growth: Māori and Pacific communities positioned as economic drivers and innovators. Indicators: enterprises started/formalised/grown through hub support, Māori and Pacific entrepreneurs engaged, repeat usage rate, revenue generated from hub-facilitated activity, jobs created or sustained.

Social & Sector Innovation: Ecosystem activations that connect communities, sectors and opportunities. Indicators: activations/events/wānanga hosted, GridAKL and innovation network connections formed, rangatahi engaged in enterprise or innovation programmes, partnerships brokered across sectors.

Ecosystem Building: A connected and collaborative enterprise support ecosystem across Tāmaki Makaurau. Indicators: organisations partnered with, cross-hub referrals, co-investment attracted from other funders, hub utilisation and venue hire metrics.

Tāmaki Rohe Economic Contribution: Local enterprises retained and grown, contributing to Auckland's inclusive economy. Indicators: local enterprises retained through hub support, new enterprises established, geographic spread of users, co-investment leverage ratio.`,
      reportingGuidance: `Reporting Rhythm:
• Monthly: Usage numbers, activations, events, venue hire → Internal / Tātaki Auckland Unlimited
• Quarterly: Inclusive growth indicators, ecosystem connections, co-investment tracking, partnership updates → EDO quarterly reporting
• Annually: Full impact report — economic indicators, qualitative stories, co-investment leverage summary, forward plan → Auckland Council / EDO annual cycle

Co-investment Partners: Ngā Mātārae MOF, Tātaki Auckland Unlimited, Local Board, Foundation North, MBIE.

What they want to see: Evidence of inclusive economic impact, geographic purpose (Tāmaki Makaurau reach), co-investment leverage from other funders, Māori and Pacific participation data, enterprise growth metrics, innovation ecosystem development.

Framing: The hub as economic infrastructure for inclusive growth — enabling Māori and Pacific enterprise, connecting innovation ecosystems, and contributing measurably to Auckland's economic development goals.`,
      reportingCadence: "quarterly",
      narrativeStyle: "compliance",
      funderTag,
      prioritySections: ["engagement", "delivery", "value"],
      contractStart: new Date("2025-07-01T00:00:00.000Z"),
      isDefault: true,
    };

    const existing = await db
      .select()
      .from(funders)
      .where(and(eq(funders.userId, userId), eq(funders.funderTag, funderTag)));

    if (existing.length > 0) {
      console.log(`Found existing EDO record (id: ${existing[0].id}). Updating...`);
      const { userId: _uid, ...updateData } = funderData;
      const [updated] = await db
        .update(funders)
        .set(updateData)
        .where(eq(funders.id, existing[0].id))
        .returning();

      console.log("✓ EDO funder updated successfully!");
      console.log("Funder ID:", updated.id);
      console.log("Funder name:", updated.name);
    } else {
      console.log("No existing EDO record found. Inserting...");
      const [inserted] = await db
        .insert(funders)
        .values(funderData)
        .returning();

      console.log("✓ EDO funder inserted successfully!");
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
        contractStart: verified.contractStart,
      });
    } else {
      console.log("✗ Funder not found in verification query");
    }
  } catch (error) {
    console.error("Error upserting EDO funder:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

upsertEdo();
