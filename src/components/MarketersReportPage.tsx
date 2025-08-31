import React, { useState, useEffect } from "react";

const MarketersReportPage = () => {
  const [marketer, setMarketer] = useState("");
  const [range, setRange] = useState("day");
  const [reports, setReports] = useState<any[]>([]);
  const [customDates, setCustomDates] = useState({ start: "", end: "" });

  const fetchReports = () => {
    let url = `${process.env.REACT_APP_BACKEND_URL}/v1/admin/marketer_reports?marketer=${marketer}&range=${range}`;
    if (range === "custom") {
      url += `&startDate=${customDates.start}&endDate=${customDates.end}`;
    }

    fetch(url)
      .then(res => res.json())
      .then(data => setReports(data))
      .catch(err => console.error(err));
  };

  return (
    <div>
      <h2>Staff Report</h2>

      <select onChange={(e) => setMarketer(e.target.value)}>
        <option value="">-- Select Staff --</option>
        <option value="In House">In House</option>
        <option value="E. Success">E. Success</option>
        <option value="O. Chinedu">O. Chinedu</option>
        <option value="K. Ese">K. Ese</option>
        <option value="A. Godsaint">A. Godsaint</option>
        <option value="O. Timileyin">O. Timileyin</option>
        <option value="A. Damilola">A. Damilola</option>
        <option value="A. Precious">A. Precious</option>
        <option value="O. Judith">O. Judith</option>
      </select>

      <select value={range} onChange={(e) => setRange(e.target.value)}>
        <option value="day">Today</option>
        <option value="week">This Week</option>
        <option value="month">This Month</option>
        <option value="custom">Custom</option>
      </select>

      {range === "custom" && (
        <div>
          <input type="date" onChange={e => setCustomDates({ ...customDates, start: e.target.value })}/>
          <input type="date" onChange={e => setCustomDates({ ...customDates, end: e.target.value })}/>
        </div>
      )}

      <button onClick={fetchReports}>Fetch Report</button>

      <div>
        {reports.map((r, i) => (
          <p key={i}>{r.marketer} - ₦{r.total}</p>
        ))}
      </div>
    </div>
  );
};

export default MarketersReportPage;
