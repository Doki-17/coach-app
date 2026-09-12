import { ArrowLeft, Download, Save } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

export default function ProgramEditor() {
  const navigate = useNavigate();
  const { clientId } = useParams();
  const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

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
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
            <Download className="w-4 h-4" /> Export PDF
          </button>
        </div>
      </div>

      {/* Editor Container (This is what will be exported) */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-2xl font-bold mb-6 uppercase tracking-wider text-center">Conditioning Program</h2>

        {/* 7-Day Calendar Grid */}
        <div className="mb-10 overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-3 w-24">Week 1</th>
                {days.map(day => (
                  <th key={day} className="border p-3 text-center font-semibold text-gray-700">{day}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border p-3 font-medium bg-gray-50">AM</td>
                {days.map(day => <td key={`${day}-am`} className="border p-3 h-20 outline-none" contentEditable suppressContentEditableWarning></td>)}
              </tr>
              <tr>
                <td className="border p-3 font-medium bg-gray-50">PM</td>
                {days.map(day => <td key={`${day}-pm`} className="border p-3 h-20 outline-none" contentEditable suppressContentEditableWarning></td>)}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Bottom Exercises Section */}
        <div>
          <h3 className="text-lg font-bold mb-4 bg-gray-100 p-2 border-l-4 border-blue-600">PLYO</h3>
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-gray-50">
              <tr>
                <th className="border p-3 w-1/3">EXERCISE</th>
                <th className="border p-3">TEMPO</th>
                <th className="border p-3">WEEK 1</th>
                <th className="border p-3">WEEK 2</th>
                <th className="border p-3">WEEK 3</th>
                <th className="border p-3">WEEK 4</th>
                <th className="border p-3">REST</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border p-3 outline-none" contentEditable suppressContentEditableWarning>Single Leg Front Jump</td>
                <td className="border p-3 text-center outline-none" contentEditable suppressContentEditableWarning>X</td>
                <td className="border p-3 text-center outline-none" contentEditable suppressContentEditableWarning>2x10</td>
                <td className="border p-3 text-center outline-none" contentEditable suppressContentEditableWarning>2x12</td>
                <td className="border p-3 text-center outline-none" contentEditable suppressContentEditableWarning>2x14</td>
                <td className="border p-3 text-center outline-none" contentEditable suppressContentEditableWarning>1x14</td>
                <td className="border p-3 text-center outline-none" contentEditable suppressContentEditableWarning>30s</td>
              </tr>
            </tbody>
          </table>
          <button className="mt-3 text-sm text-blue-600 font-medium hover:underline">+ Add Exercise Row</button>
        </div>
      </div>
    </div>
  );
}