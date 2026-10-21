import express from "express";
import { or, ilike, and, sql, eq, getTableColumns, desc } from "drizzle-orm";
import { subjects, departments } from "../db/schema/app.js";
import { db } from "../db/index.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { search, department, page = 1, limit = 10 } = req.query;
    const currentPage = Math.max(1, +page);
    const limitPerPage = Math.max(1, +limit);
    const offset = (currentPage - 1) * limitPerPage;

    const filterConditions = [];
    if (search) {
      filterConditions.push(or(ilike(subjects.name, `%${search}%`), ilike(subjects.code, `%${search}%`)));
    }
    if (department) {
      filterConditions.push(ilike(departments.name, `%${department}%`));
    }

    const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

    const countResults = await db
      .select({ count: sql<number>`count(*)` })
      .from(subjects)
      .leftJoin(departments, eq(subjects.departmentId, departments.id))
      .where(whereClause);
    const totalCount = countResults[0]?.count ?? 0;

    const subjectsResults = await db
      .select({
        ...getTableColumns(subjects),
        department: getTableColumns(departments),
      })
      .from(subjects)
      .leftJoin(departments, eq(subjects.departmentId, departments.id))
      .where(whereClause)
      .orderBy(desc(subjects.createdAt))
      .limit(limitPerPage)
      .offset(offset);

    res.status(200).json({
      data: subjectsResults,
      pagination: {
        page: currentPage,
        limit: limitPerPage,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitPerPage),
      },
      totalCount,
      currentPage,
      limitPerPage,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "An error occurred while fetching subjects" });
  }
});

export default router;
