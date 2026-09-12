import React, { useState, useRef } from 'react';
import { ArrowLeft, Download, Save, Plus, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print'; // <--- NEW IMPORT

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

export default function ProgramEditor() {
  const navigate = useNavigate();
  const { clientId } = useParams();
  const printRef = useRef<HTMLDivElement>(null);

  // --- STATE MANAGEMENT ---
  const [weeks, setWeeks] = useState([
    { id: 1, am: Array(7).fill(''), pm: Array(7).fill('') }
  ]);

  const [categories, setCategories] = useState([
    {
      id: crypto.randomUUID(),
      name: 'PLYO',
      exercises: [
        { id: crypto.randomUUID(), name: 'Single Leg Front Jump', tempo: 'X', w1: '2x10', w2: '2x12', w3: '2x14', w4: '1x14', rest: '30s' }
      ]
    }
  ]);

  // --- HANDLERS ---
  const addWeek = () => {
    setWeeks([...weeks, { id: weeks.length + 1, am: Array(7).fill(''), pm: Array(7).fill('') }]);
  };

  const updateDay = (weekIndex: number, period: 'am' | 'pm', dayIndex: number, value: string) => {
    const newWeeks = [...weeks];
    newWeeks[weekIndex][period][dayIndex] = value;
    setWeeks(newWeeks);
  };

  const addCategory = () => {
    setCategories([...categories, { id: crypto.randomUUID(), name: 'NEW CATEGORY', exercises: [] }]);
  };

  const updateCategoryName = (catIndex: number, value: string) => {
    const newCategories = [...categories];
    newCategories[catIndex].name = value;
    setCategories(newCategories);
  };

  const addExercise = (catIndex: number) => {
    const newCategories = [...categories];
    newCategories[catIndex].exercises.push({
      id: crypto.randomUUID(), name: '', tempo: '', w1: '', w2: '', w3: '', w4: '', rest: ''
    });
    setCategories(newCategories);
  };

  const updateExercise = (catIndex: number, exIndex: number, field: string, value: string) => {
    const newCategories = [...categories];
    newCategories[catIndex].exercises[exIndex] = {
      ...newCategories[catIndex].exercises[exIndex],
      [field]: value
    };
    setCategories(newCategories);
  };

  const deleteExercise = (catIndex: number, exIndex: number) => {
    const newCategories = [...categories];
    newCategories[catIndex].exercises.splice(exIndex, 1);
    setCategories(newCategories);
  };

  // --- NEW PDF EXPORT LOGIC ---
  const handleExportPDF = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Conditioning_Program_${clientId || 'Client'}`,
    // Optional: Add custom print styles to ensure landscape formatting
    pageStyle: `
      @page { size: landscape; margin: 10mm; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    `,
  });

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header Actions */}
      <div className="flex justify-between items-center mb-6">
        <button onClick={() => navigate('/')} className="text-gray-600 hover:text-gray-900 flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
        <div className="flex gap-3">
          <button className="bg-white border border-gray-300 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-50">
            <Save className="w-4 h-4" /> Save
          </button>
          <button onClick={() => handleExportPDF()} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
            <Download className="w-4 h-4" /> Export PDF
          </button>
        </div>
      </div>

      {/* Editor Container (This gets exported) */}
      <div ref={printRef} className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-2xl font-bold mb-6 uppercase tracking-wider text-center">Conditioning Program</h2>

        {/* Dynamic Calendar Grid */}
        <div className="mb-10 overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse table-fixed">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-3 w-24">Week</th>
                {DAYS.map(day => (
                  <th key={day} className="border p-3 text-center font-semibold text-gray-700 w-32">{day}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, wIndex) => (
                <React.Fragment key={week.id}>
                  {/* AM Row */}
                  <tr>
                    <td className="border p-3 font-bold bg-gray-50 text-center" rowSpan={2}>
                      Week {week.id}
                    </td>
                    {DAYS.map((_, dIndex) => (
                      <td key={`am-${dIndex}`} className="border p-0 h-20 align-top relative">
                         <span className="absolute top-1 left-1 text-[10px] text-gray-400 font-medium">AM</span>
                        <textarea 
                          value={week.am[dIndex]}
                          onChange={(e) => updateDay(wIndex, 'am', dIndex, e.target.value)}
                          className="w-full h-full p-2 pt-5 resize-none outline-none bg-transparent text-sm focus:bg-blue-50 transition-colors"
                        />
                      </td>
                    ))}
                  </tr>
                  {/* PM Row */}
                  <tr>
                    {DAYS.map((_, dIndex) => (
                      <td key={`pm-${dIndex}`} className="border p-0 h-20 align-top relative">
                        <span className="absolute top-1 left-1 text-[10px] text-gray-400 font-medium">PM</span>
                        <textarea 
                          value={week.pm[dIndex]}
                          onChange={(e) => updateDay(wIndex, 'pm', dIndex, e.target.value)}
                          className="w-full h-full p-2 pt-5 resize-none outline-none bg-transparent text-sm focus:bg-blue-50 transition-colors"
                        />
                      </td>
                    ))}
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
          
          {/* Hide this button during printing */}
          <button className="print:hidden mt-3 flex items-center gap-1 text-sm text-blue-600 font-medium hover:underline" onClick={addWeek}>
            <Plus className="w-4 h-4" /> Add Week
          </button>
        </div>

        {/* Dynamic Exercise Categories */}
        <div className="space-y-8">
          {categories.map((category, catIndex) => (
            <div key={category.id}>
              <div className="flex items-center gap-2 mb-4 bg-gray-100 p-2 border-l-4 border-blue-600">
                <input 
                  value={category.name}
                  onChange={(e) => updateCategoryName(catIndex, e.target.value)}
                  className="text-lg font-bold bg-transparent outline-none uppercase w-full focus:bg-white focus:px-2 rounded transition-all"
                />
              </div>
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border p-3 w-1/4">EXERCISE</th>
                    <th className="border p-3 w-16 text-center">TEMPO</th>
                    <th className="border p-3 text-center">WEEK 1</th>
                    <th className="border p-3 text-center">WEEK 2</th>
                    <th className="border p-3 text-center">WEEK 3</th>
                    <th className="border p-3 text-center">WEEK 4</th>
                    <th className="border p-3 w-20 text-center">REST</th>
                    <th className="border p-3 w-10 print:hidden"></th>
                  </tr>
                </thead>
                <tbody>
                  {category.exercises.map((ex, exIndex) => (
                    <tr key={ex.id} className="group hover:bg-gray-50">
                      <td className="border p-0"><input value={ex.name} onChange={e => updateExercise(catIndex, exIndex, 'name', e.target.value)} className="w-full p-3 bg-transparent outline-none focus:bg-blue-50" /></td>
                      <td className="border p-0"><input value={ex.tempo} onChange={e => updateExercise(catIndex, exIndex, 'tempo', e.target.value)} className="w-full p-3 bg-transparent outline-none text-center focus:bg-blue-50" /></td>
                      <td className="border p-0"><input value={ex.w1} onChange={e => updateExercise(catIndex, exIndex, 'w1', e.target.value)} className="w-full p-3 bg-transparent outline-none text-center focus:bg-blue-50" /></td>
                      <td className="border p-0"><input value={ex.w2} onChange={e => updateExercise(catIndex, exIndex, 'w2', e.target.value)} className="w-full p-3 bg-transparent outline-none text-center focus:bg-blue-50" /></td>
                      <td className="border p-0"><input value={ex.w3} onChange={e => updateExercise(catIndex, exIndex, 'w3', e.target.value)} className="w-full p-3 bg-transparent outline-none text-center focus:bg-blue-50" /></td>
                      <td className="border p-0"><input value={ex.w4} onChange={e => updateExercise(catIndex, exIndex, 'w4', e.target.value)} className="w-full p-3 bg-transparent outline-none text-center focus:bg-blue-50" /></td>
                      <td className="border p-0"><input value={ex.rest} onChange={e => updateExercise(catIndex, exIndex, 'rest', e.target.value)} className="w-full p-3 bg-transparent outline-none text-center focus:bg-blue-50" /></td>
                      <td className="border p-0 text-center print:hidden">
                        <button onClick={() => deleteExercise(catIndex, exIndex)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="w-4 h-4 mx-auto" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="print:hidden mt-2 flex items-center gap-1 text-sm text-blue-600 font-medium hover:underline" onClick={() => addExercise(catIndex)}>
                <Plus className="w-4 h-4" /> Add Exercise Row
              </button>
            </div>
          ))}
        </div>

        <button className="print:hidden mt-8 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-200 font-medium w-full justify-center border border-gray-300" onClick={addCategory}>
          <Plus className="w-5 h-5" /> Add New Category (e.g. UB MXS, LB MXS)
        </button>

      </div>
    </div>
  );
}