import { useState, useEffect, useMemo } from "react";
import type { Subject } from "../../types";
import getSubjects from "../../services/subjects";
import { Link } from "react-router"
import type { ColumnDef } from "@tanstack/react-table";
import { useReactTable, getCoreRowModel, flexRender } from "@tanstack/react-table";

const columns: ColumnDef<Subject>[] = [
  {
    accessorKey: "code",
    header: "Code",
    cell: ({ getValue }) => (
      <span className="subject-code">{getValue<string>()}</span>
    )
  },
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "department",
    header: "Department",
    cell: ({ getValue }) => (
      <span className="subject-department">{getValue<string>()}</span>
    )
  },
  {
    accessorKey: "description",
    header: "Description",
  },
];

const SubjectsListPage = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [error, setError] = useState("");

  useEffect(() => {
    getSubjects().then((data) => {
      setSubjects(data);
      setIsLoading(false);
    }).catch(() => {
      setError("Failed to fetch subjects");
      setIsLoading(false);
    });
  }, []);

  const filteredSubjects = useMemo(() => {
    return subjects.filter((subject) => {
      return (
        subject.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        (selectedDepartment === "all" || subject.department === selectedDepartment)
      );
    });
  }, [subjects, searchQuery, selectedDepartment]);

  const table = useReactTable({
    data: filteredSubjects,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row.id)
  });

  if (error) {
    return <p role="alert">{error}</p>;
  }

  return (
    <div className="class-view">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link> <span aria-hidden="true">/</span> <span aria-current="page">Subjects</span>
      </nav>

      <h1 className="page-title">Subjects</h1>
      <div className="intro-row">
        <p>Quick access to essentials</p>
        <div className="actions-row">
          <input
            className="form-control"
            type="search"
            aria-label="Search subjects"
            placeholder="Search subjects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <select
            className="form-control"
            value={selectedDepartment}
            aria-label="Select department"
            onChange={(e) => setSelectedDepartment(e.target.value)}
          >
            <option value="all">All Departments</option>
            <option value="Mathematics">Mathematics</option>
            <option value="Physics">Physics</option>
            <option value="Chemistry">Chemistry</option>
          </select>
          <Link className="primary-link" to="/subjects/create">Create Subject</Link>
        </div>
      </div>

      {isLoading ? (
        <p>Loading subjects...</p>
      ) : (
        filteredSubjects.length === 0 ? (
          <p>No subjects found.</p>
        ) : (
          <table className="subjects-table">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              ))}
            </tbody>

          </table>
        )
      )}
    </div>
  )
}

export default SubjectsListPage

